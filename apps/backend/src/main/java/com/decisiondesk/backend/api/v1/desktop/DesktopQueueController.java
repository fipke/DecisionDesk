package com.decisiondesk.backend.api.v1.desktop;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.model.Transcript;
import com.decisiondesk.backend.meetings.model.UsageRecord;
import com.decisiondesk.backend.meetings.persistence.MeetingRepository;
import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.meetings.persistence.UsageRecordRepository;
import com.decisiondesk.backend.meetings.service.DesktopQueueService;
import com.decisiondesk.backend.meetings.service.DesktopTranscriptionJob;
import com.decisiondesk.backend.web.ApiException;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

/**
 * REST controller for desktop app queue operations.
 * 
 * <p>The desktop app polls this endpoint for pending jobs, downloads
 * audio files, processes them locally, and POSTs results back.</p>
 */
@RestController
@RequestMapping(path = "/api/v1/desktop", produces = MediaType.APPLICATION_JSON_VALUE)
@ConditionalOnProperty(name = "transcription.desktop.enabled", havingValue = "true")
public class DesktopQueueController {

    private final DesktopQueueService queueService;
    private final MeetingRepository meetingRepository;
    private final TranscriptRepository transcriptRepository;
    private final UsageRecordRepository usageRecordRepository;

    public DesktopQueueController(DesktopQueueService queueService,
                                   MeetingRepository meetingRepository,
                                   TranscriptRepository transcriptRepository,
                                   UsageRecordRepository usageRecordRepository) {
        this.queueService = queueService;
        this.meetingRepository = meetingRepository;
        this.transcriptRepository = transcriptRepository;
        this.usageRecordRepository = usageRecordRepository;
    }

    @GetMapping("/queue")
    @Operation(summary = "List pending transcription jobs", 
               description = "Returns all jobs waiting for desktop processing")
    @ApiResponse(responseCode = "200", description = "List of pending jobs")
    public List<PendingJobResponse> listPendingJobs() {
        return queueService.getPendingJobs().stream()
                .map(job -> new PendingJobResponse(
                        job.meetingId(),
                        job.model().getValue(),
                        job.language(),
                        job.enableDiarization()))
                .toList();
    }

    @PostMapping("/queue/{meetingId}/accept")
    @Operation(summary = "Accept a job for processing",
               description = "Desktop app calls this when starting to process a job")
    @ApiResponse(responseCode = "200", description = "Job accepted")
    public AcceptJobResponse acceptJob(@PathVariable UUID meetingId) {
        DesktopTranscriptionJob job = queueService.getJob(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "JOB_NOT_FOUND", 
                        "No pending job for meeting " + meetingId));
        
        queueService.markAccepted(meetingId);
        
        return new AcceptJobResponse(
                meetingId,
                job.model().getValue(),
                job.language(),
                job.enableDiarization(),
                "/api/v1/desktop/queue/" + meetingId + "/audio");
    }

    @GetMapping("/queue/{meetingId}/audio")
    @Operation(summary = "Download audio for processing",
               description = "Returns the audio file for the meeting")
    @ApiResponse(responseCode = "200", description = "Audio file")
    public ResponseEntity<Resource> downloadAudio(@PathVariable UUID meetingId) {
        DesktopTranscriptionJob job = queueService.getJob(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "JOB_NOT_FOUND", 
                        "No job for meeting " + meetingId));

        Resource resource = new FileSystemResource(job.audioPath().toFile());
        if (!resource.exists()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "AUDIO_NOT_FOUND", 
                    "Audio file not found for meeting " + meetingId);
        }

        String filename = job.audioPath().getFileName().toString();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @PostMapping("/queue/{meetingId}/result")
    @Operation(summary = "Submit transcription result",
               description = "Desktop app posts the transcription result here")
    @ApiResponse(responseCode = "200", description = "Result accepted")
    public ResultResponse submitResult(@PathVariable UUID meetingId, 
                                        @RequestBody TranscriptionResultRequest result) {
        DesktopTranscriptionJob job = queueService.getJob(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "JOB_NOT_FOUND", 
                        "No job for meeting " + meetingId));

        if (result.error() != null) {
            queueService.markFailed(meetingId, result.error());
            meetingRepository.updateStatus(meetingId, MeetingStatus.ERROR);
            return new ResultResponse(meetingId, MeetingStatus.ERROR);
        }

        // Save transcript
        Transcript transcript = new Transcript(
                UUID.randomUUID(),
                meetingId,
                result.language() != null ? result.language() : job.language(),
                result.text(),
                OffsetDateTime.now(ZoneOffset.UTC));
        transcriptRepository.upsert(transcript);

        // Save usage record (free - zero cost)
        UsageRecord usageRecord = new UsageRecord(
                UUID.randomUUID(),
                meetingId,
                UsageRecord.Service.WHISPER,
                result.durationMinutes() != null ? result.durationMinutes() : BigDecimal.ONE,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                buildUsageMeta(job, result),
                OffsetDateTime.now(ZoneOffset.UTC));
        usageRecordRepository.insert(usageRecord);

        queueService.markCompleted(meetingId);
        meetingRepository.updateStatus(meetingId, MeetingStatus.DONE);

        return new ResultResponse(meetingId, MeetingStatus.DONE);
    }

    private String buildUsageMeta(DesktopTranscriptionJob job, TranscriptionResultRequest result) {
        return """
                {"provider":"desktop_local","model":"%s","diarization":%s,"processingTimeMs":%d}
                """.formatted(
                job.model().getValue(),
                job.enableDiarization(),
                result.processingTimeMs() != null ? result.processingTimeMs() : 0
        ).trim();
    }

    // DTOs

    public record PendingJobResponse(
            @Schema(description = "Meeting ID") UUID meetingId,
            @Schema(description = "Whisper model") String model,
            @Schema(description = "Language code") String language,
            @Schema(description = "Diarization enabled") boolean diarization
    ) {}

    public record AcceptJobResponse(
            UUID meetingId,
            String model,
            String language,
            boolean diarization,
            String audioUrl
    ) {}

    public record TranscriptionResultRequest(
            @Schema(description = "Transcribed text") String text,
            @Schema(description = "Detected language") String language,
            @Schema(description = "Duration in minutes") BigDecimal durationMinutes,
            @Schema(description = "Processing time in ms") Long processingTimeMs,
            @Schema(description = "Segments with timestamps/speakers") String segments,
            @Schema(description = "Error message if failed") String error
    ) {}

    public record ResultResponse(UUID meetingId, MeetingStatus status) {}
}
