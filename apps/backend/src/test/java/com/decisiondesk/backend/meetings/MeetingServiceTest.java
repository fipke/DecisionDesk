package com.decisiondesk.backend.meetings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import com.decisiondesk.backend.config.AppProps;
import com.decisiondesk.backend.meetings.model.AudioAsset;
import com.decisiondesk.backend.meetings.model.AudioUploadResult;
import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.persistence.AudioAssetRepository;
import com.decisiondesk.backend.meetings.persistence.MeetingRepository;
import com.decisiondesk.backend.meetings.persistence.SummaryRepository;
import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.meetings.persistence.UsageRecordRepository;
import com.decisiondesk.backend.meetings.service.TranscriptionOperations;

@ExtendWith(MockitoExtension.class)
class MeetingServiceTest {

    @Mock
    private MeetingRepository meetingRepository;
    @Mock
    private AudioAssetRepository audioAssetRepository;
    @Mock
    private TranscriptRepository transcriptRepository;
    @Mock
    private SummaryRepository summaryRepository;
    @Mock
    private UsageRecordRepository usageRecordRepository;
    @Mock
    private AudioStorageService storageService;
    @Mock
    private MeetingCostAggregator costAggregator;
    @Mock
    private TranscriptionOperations transcriptionService;

    private MeetingService meetingService;

    @BeforeEach
    void setUp() {
        AppProps appProps = new AppProps(
                "0.1.0",
                new AppProps.Upload(200),
                new AppProps.Ai("pt"),
                new AppProps.Features(false));
        meetingService = new MeetingService(
                meetingRepository,
                audioAssetRepository,
                transcriptRepository,
                summaryRepository,
                usageRecordRepository,
                storageService,
                costAggregator,
                appProps,
                transcriptionService);
    }

    @Test
    void uploadAudioStoresFileWithoutTranscribingWhenFeatureDisabled() throws Exception {
        UUID meetingId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "sample.m4a", "audio/mp4", new byte[] {1, 2, 3});

        when(meetingRepository.findById(meetingId))
                .thenReturn(Optional.of(new Meeting(meetingId, OffsetDateTime.now(), MeetingStatus.NEW)));
        when(storageService.store(meetingId, file))
                .thenReturn(new AudioStorageService.StoredAudio(assetId, Path.of("/tmp/sample.m4a"), file.getSize(), "sample.m4a", "audio/mp4"));
        when(audioAssetRepository.save(any(AudioAsset.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AudioUploadResult result = meetingService.uploadAudio(meetingId, file);

        assertThat(result.meetingId()).isEqualTo(meetingId);
        assertThat(result.assetId()).isEqualTo(assetId);
        assertThat(result.status()).isEqualTo(MeetingStatus.NEW);
        verify(meetingRepository).updateStatus(meetingId, MeetingStatus.NEW);
        verify(transcriptionService, never()).transcribe(any(UUID.class));
    }
}
