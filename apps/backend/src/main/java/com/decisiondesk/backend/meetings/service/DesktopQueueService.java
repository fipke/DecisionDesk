package com.decisiondesk.backend.meetings.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Service for managing the desktop transcription queue.
 * 
 * <p>Jobs are enqueued when users request desktop_local transcription.
 * The desktop app polls for pending jobs, downloads audio, processes,
 * and POSTs the result back.</p>
 */
public interface DesktopQueueService {

    /**
     * Add a transcription job to the queue.
     *
     * @param job the job to enqueue
     */
    void enqueue(DesktopTranscriptionJob job);

    /**
     * Get all pending jobs (for desktop app to poll).
     *
     * @return list of pending jobs
     */
    List<DesktopTranscriptionJob> getPendingJobs();

    /**
     * Get a specific job by meeting ID.
     *
     * @param meetingId the meeting ID
     * @return the job if found
     */
    Optional<DesktopTranscriptionJob> getJob(UUID meetingId);

    /**
     * Mark a job as accepted by the desktop app.
     *
     * @param meetingId the meeting ID
     */
    void markAccepted(UUID meetingId);

    /**
     * Mark a job as completed.
     *
     * @param meetingId the meeting ID
     */
    void markCompleted(UUID meetingId);

    /**
     * Mark a job as failed.
     *
     * @param meetingId the meeting ID
     * @param error     error message
     */
    void markFailed(UUID meetingId, String error);

    /**
     * Cancel a pending job.
     *
     * @param meetingId the meeting ID
     */
    void cancel(UUID meetingId);
}
