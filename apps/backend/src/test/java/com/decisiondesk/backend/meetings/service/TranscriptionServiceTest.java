package com.decisiondesk.backend.meetings.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.decisiondesk.backend.config.AppProps;
import com.decisiondesk.backend.cost.WhisperCostCalculator;
import com.decisiondesk.backend.cost.WhisperCostEstimate;
import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.model.AudioAsset;
import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.model.Transcript;
import com.decisiondesk.backend.meetings.model.UsageRecord;
import com.decisiondesk.backend.meetings.persistence.AudioAssetRepository;
import com.decisiondesk.backend.meetings.persistence.MeetingRepository;
import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.meetings.persistence.UsageRecordRepository;
import com.decisiondesk.backend.openai.WhisperClient;
import com.decisiondesk.backend.openai.WhisperTranscription;
import com.decisiondesk.backend.openai.WhisperClientException;
import com.decisiondesk.backend.web.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class TranscriptionServiceTest {

    @Mock
    private MeetingRepository meetingRepository;
    @Mock
    private AudioAssetRepository audioAssetRepository;
    @Mock
    private TranscriptRepository transcriptRepository;
    @Mock
    private UsageRecordRepository usageRecordRepository;
    @Mock
    private WhisperClient whisperClient;
    @Mock
    private WhisperCostCalculator costCalculator;

    @TempDir
    Path tempDir;

    private TranscriptionService transcriptionService;

    @BeforeEach
    void setUp() {
        AppProps appProps = new AppProps(
                "0.1.0",
                new AppProps.Upload(200),
                new AppProps.Ai("pt"),
                new AppProps.Features(false));
        transcriptionService = new TranscriptionService(
                meetingRepository,
                audioAssetRepository,
                transcriptRepository,
                usageRecordRepository,
                whisperClient,
                costCalculator,
                appProps,
                new ObjectMapper(),
                Optional.empty(),
                Optional.empty());
    }

    @Test
    void transcribePersistsTranscriptAndUsageAndMarksDone() throws Exception {
        UUID meetingId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        Path audioPath = Files.createFile(tempDir.resolve("audio.m4a"));

        when(meetingRepository.findById(meetingId))
                .thenReturn(Optional.of(new Meeting(meetingId, OffsetDateTime.now(), MeetingStatus.NEW)));
        when(audioAssetRepository.findLatestByMeetingId(meetingId))
                .thenReturn(Optional.of(new AudioAsset(assetId, meetingId, audioPath.toString(), "m4a", null, 123L, null, OffsetDateTime.now())));
        when(whisperClient.transcribe(any(Path.class), any(String.class), any(), any(String.class)))
                .thenReturn(new WhisperTranscription("resp-1", "transcribed", "en", 95.0, "whisper-1"));
        when(costCalculator.estimateFromMinutes(any(BigDecimal.class)))
                .thenReturn(new WhisperCostEstimate(new BigDecimal("2"), new BigDecimal("0.012"), new BigDecimal("0.060")));

        MeetingStatus status = transcriptionService.transcribe(meetingId);

        assertThat(status).isEqualTo(MeetingStatus.DONE);
        verify(meetingRepository).updateStatus(meetingId, MeetingStatus.PROCESSING);
        verify(meetingRepository).updateStatus(meetingId, MeetingStatus.DONE);

        ArgumentCaptor<Transcript> transcriptCaptor = ArgumentCaptor.forClass(Transcript.class);
        verify(transcriptRepository).upsert(transcriptCaptor.capture());
        assertThat(transcriptCaptor.getValue().meetingId()).isEqualTo(meetingId);
        assertThat(transcriptCaptor.getValue().text()).isEqualTo("transcribed");

        ArgumentCaptor<UsageRecord> usageCaptor = ArgumentCaptor.forClass(UsageRecord.class);
        verify(usageRecordRepository).insert(usageCaptor.capture());
        UsageRecord usage = usageCaptor.getValue();
        assertThat(usage.meetingId()).isEqualTo(meetingId);
        assertThat(usage.service()).isEqualTo(UsageRecord.Service.WHISPER);
        assertThat(usage.meta()).contains("\"provider\":\"remote_openai\"");
    }

    @Test
    void transcribeMarksErrorWhenWhisperFails() throws Exception {
        UUID meetingId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        Path audioPath = Files.createFile(tempDir.resolve("audio.m4a"));

        when(meetingRepository.findById(meetingId))
                .thenReturn(Optional.of(new Meeting(meetingId, OffsetDateTime.now(), MeetingStatus.NEW)));
        when(audioAssetRepository.findLatestByMeetingId(meetingId))
                .thenReturn(Optional.of(new AudioAsset(assetId, meetingId, audioPath.toString(), "m4a", null, 123L, null, OffsetDateTime.now())));
        when(whisperClient.transcribe(any(Path.class), any(String.class), any(), any(String.class)))
                .thenThrow(new WhisperClientException("boom"));

        assertThatThrownBy(() -> transcriptionService.transcribe(meetingId))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).code()).isEqualTo("OPENAI_WHISPER_FAILED"));

        verify(meetingRepository).updateStatus(meetingId, MeetingStatus.PROCESSING);
        verify(meetingRepository).updateStatus(meetingId, MeetingStatus.ERROR);
    }
}
