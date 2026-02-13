package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.decisiondesk.backend.meetings.WhisperModel;

/**
 * Represents a transcription job in the desktop queue.
 *
 * @param id              unique job ID
 * @param meetingId       meeting to transcribe
 * @param audioPath       path to audio file on server
 * @param model           whisper model to use
 * @param language        target language
 * @param enableDiarization whether to perform speaker identification
 * @param status          current job status
 * @param acceptedAt      when desktop app accepted the job
 * @param completedAt     when job was completed
 * @param errorMessage    error message if failed
 * @param retryCount      number of retry attempts
 * @param createdAt       when job was created
 * @param updatedAt       last update timestamp
 */
public record TranscriptionQueueJob(
        UUID id,
        UUID meetingId,
        String audioPath,
        WhisperModel model,
        String language,
        boolean enableDiarization,
        JobStatus status,
        OffsetDateTime acceptedAt,
        OffsetDateTime completedAt,
        String errorMessage,
        int retryCount,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public enum JobStatus {
        PENDING,
        ACCEPTED,
        PROCESSING,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    /**
     * Creates a new pending job.
     */
    public static TranscriptionQueueJob create(
            UUID meetingId,
            String audioPath,
            WhisperModel model,
            String language,
            boolean enableDiarization) {
        OffsetDateTime now = OffsetDateTime.now();
        return new TranscriptionQueueJob(
                UUID.randomUUID(),
                meetingId,
                audioPath,
                model,
                language,
                enableDiarization,
                JobStatus.PENDING,
                null,
                null,
                null,
                0,
                now,
                now
        );
    }

    /**
     * Marks job as accepted.
     */
    public TranscriptionQueueJob accept() {
        return new TranscriptionQueueJob(
                id, meetingId, audioPath, model, language, enableDiarization,
                JobStatus.ACCEPTED,
                OffsetDateTime.now(),
                completedAt, errorMessage, retryCount, createdAt, updatedAt
        );
    }

    /**
     * Marks job as processing.
     */
    public TranscriptionQueueJob startProcessing() {
        return new TranscriptionQueueJob(
                id, meetingId, audioPath, model, language, enableDiarization,
                JobStatus.PROCESSING,
                acceptedAt, completedAt, errorMessage, retryCount, createdAt, updatedAt
        );
    }

    /**
     * Marks job as completed.
     */
    public TranscriptionQueueJob complete() {
        return new TranscriptionQueueJob(
                id, meetingId, audioPath, model, language, enableDiarization,
                JobStatus.COMPLETED,
                acceptedAt,
                OffsetDateTime.now(),
                null, retryCount, createdAt, updatedAt
        );
    }

    /**
     * Marks job as failed with error message.
     */
    public TranscriptionQueueJob fail(String error) {
        return new TranscriptionQueueJob(
                id, meetingId, audioPath, model, language, enableDiarization,
                JobStatus.FAILED,
                acceptedAt, completedAt, error, retryCount + 1, createdAt, updatedAt
        );
    }

    /**
     * Marks job as cancelled.
     */
    public TranscriptionQueueJob cancel() {
        return new TranscriptionQueueJob(
                id, meetingId, audioPath, model, language, enableDiarization,
                JobStatus.CANCELLED,
                acceptedAt, completedAt, "Cancelled by user", retryCount, createdAt, updatedAt
        );
    }

    /**
     * Resets job to pending for retry.
     */
    public TranscriptionQueueJob retry() {
        return new TranscriptionQueueJob(
                id, meetingId, audioPath, model, language, enableDiarization,
                JobStatus.PENDING,
                null, null, null, retryCount + 1, createdAt, updatedAt
        );
    }

    /**
     * Checks if job can be retried (not exceeded max retries).
     */
    public boolean canRetry(int maxRetries) {
        return status == JobStatus.FAILED && retryCount < maxRetries;
    }
}
