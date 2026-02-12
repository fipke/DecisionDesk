package com.decisiondesk.backend.meetings.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * In-memory implementation of DesktopQueueService.
 * 
 * <p>For production, consider using a database-backed implementation
 * to survive restarts and support multiple backend instances.</p>
 * 
 * <p>Configuration:</p>
 * <ul>
 *   <li>{@code transcription.desktop.enabled=true} - enable this service</li>
 * </ul>
 */
@Service
@ConditionalOnProperty(name = "transcription.desktop.enabled", havingValue = "true")
public class InMemoryDesktopQueueService implements DesktopQueueService {

    private static final Logger log = LoggerFactory.getLogger(InMemoryDesktopQueueService.class);

    private final Map<UUID, QueuedJob> queue = new ConcurrentHashMap<>();

    private enum JobStatus {
        PENDING, ACCEPTED, COMPLETED, FAILED
    }

    private record QueuedJob(DesktopTranscriptionJob job, JobStatus status, String error) {
        QueuedJob withStatus(JobStatus newStatus) {
            return new QueuedJob(job, newStatus, error);
        }

        QueuedJob withError(String error) {
            return new QueuedJob(job, JobStatus.FAILED, error);
        }
    }

    @Override
    public void enqueue(DesktopTranscriptionJob job) {
        queue.put(job.meetingId(), new QueuedJob(job, JobStatus.PENDING, null));
        log.info("Job queued for desktop: meetingId={}, model={}", job.meetingId(), job.model());
    }

    @Override
    public List<DesktopTranscriptionJob> getPendingJobs() {
        List<DesktopTranscriptionJob> pending = new ArrayList<>();
        for (QueuedJob queuedJob : queue.values()) {
            if (queuedJob.status() == JobStatus.PENDING) {
                pending.add(queuedJob.job());
            }
        }
        return pending;
    }

    @Override
    public Optional<DesktopTranscriptionJob> getJob(UUID meetingId) {
        QueuedJob queuedJob = queue.get(meetingId);
        return queuedJob != null ? Optional.of(queuedJob.job()) : Optional.empty();
    }

    @Override
    public void markAccepted(UUID meetingId) {
        queue.computeIfPresent(meetingId, (id, job) -> job.withStatus(JobStatus.ACCEPTED));
        log.info("Job accepted by desktop: meetingId={}", meetingId);
    }

    @Override
    public void markCompleted(UUID meetingId) {
        queue.computeIfPresent(meetingId, (id, job) -> job.withStatus(JobStatus.COMPLETED));
        log.info("Job completed by desktop: meetingId={}", meetingId);
        // Cleanup completed jobs after marking
        queue.remove(meetingId);
    }

    @Override
    public void markFailed(UUID meetingId, String error) {
        queue.computeIfPresent(meetingId, (id, job) -> job.withError(error));
        log.error("Job failed on desktop: meetingId={}, error={}", meetingId, error);
    }

    @Override
    public void cancel(UUID meetingId) {
        QueuedJob removed = queue.remove(meetingId);
        if (removed != null) {
            log.info("Job cancelled: meetingId={}", meetingId);
        }
    }
}
