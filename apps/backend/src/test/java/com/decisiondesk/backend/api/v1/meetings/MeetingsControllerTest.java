package com.decisiondesk.backend.api.v1.meetings;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import com.decisiondesk.backend.meetings.MeetingService;
import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.model.AudioUploadResult;
import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.model.MeetingCostBreakdown;
import com.decisiondesk.backend.meetings.model.MeetingDetails;
import com.decisiondesk.backend.meetings.model.Transcript;

@ExtendWith(MockitoExtension.class)
class MeetingsControllerTest {

    @Mock
    private MeetingService meetingService;

    private MeetingsController controller;

    @BeforeEach
    void setUp() {
        controller = new MeetingsController(meetingService);
    }

    @Test
    void createMeetingReturnsResponse() {
        Meeting meeting = new Meeting(UUID.randomUUID(), OffsetDateTime.now(), MeetingStatus.NEW);
        when(meetingService.createMeeting()).thenReturn(meeting);

        CreateMeetingResponse response = controller.createMeeting();

        assertThat(response.id()).isEqualTo(meeting.id());
        assertThat(response.createdAt()).isEqualTo(meeting.createdAt());
    }

    @Test
    void uploadAudioReturnsResult() {
        UUID meetingId = UUID.randomUUID();
        UUID assetId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile("file", "sample.m4a", "audio/mp4", new byte[] {1, 2, 3});
        when(meetingService.uploadAudio(meetingId, file)).thenReturn(new AudioUploadResult(meetingId, assetId, MeetingStatus.NEW));

        UploadAudioResponse response = controller.uploadAudio(meetingId, file);

        assertThat(response.meetingId()).isEqualTo(meetingId);
        assertThat(response.assetId()).isEqualTo(assetId);
        assertThat(response.status()).isEqualTo(MeetingStatus.NEW);
        verify(meetingService).uploadAudio(meetingId, file);
    }

    @Test
    void transcribeReturnsStatus() {
        UUID meetingId = UUID.randomUUID();
        when(meetingService.transcribeMeeting(meetingId)).thenReturn(MeetingStatus.DONE);

        TranscribeResponse response = controller.transcribe(meetingId, null);

        assertThat(response.meetingId()).isEqualTo(meetingId);
        assertThat(response.status()).isEqualTo(MeetingStatus.DONE);
        verify(meetingService).transcribeMeeting(meetingId);
    }

    @Test
    void getMeetingMapsDetails() {
        UUID meetingId = UUID.randomUUID();
        Transcript transcript = new Transcript(UUID.randomUUID(), meetingId, "pt", "Olá", OffsetDateTime.now());
        MeetingCostBreakdown cost = new MeetingCostBreakdown(
                new MeetingCostBreakdown.WhisperCost(BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE),
                null,
                new MeetingCostBreakdown.TotalCost(BigDecimal.ONE, BigDecimal.ONE));
        MeetingDetails details = new MeetingDetails(meetingId, MeetingStatus.DONE, OffsetDateTime.now(), transcript, null, cost);
        when(meetingService.getMeeting(meetingId)).thenReturn(details);

        MeetingDetailsResponse response = controller.getMeeting(meetingId);

        assertThat(response.id()).isEqualTo(meetingId);
        assertThat(response.transcript()).isNotNull();
        assertThat(response.transcript().language()).isEqualTo("pt");
        verify(meetingService).getMeeting(meetingId);
    }
}
