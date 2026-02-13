package com.decisiondesk.backend.meetings.service;

import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.decisiondesk.backend.config.AppProps;
import com.decisiondesk.backend.meetings.model.TranscriptionQueueJob;
import com.decisiondesk.backend.meetings.model.TranscriptionQueueJob.JobStatus;
import com.decisiondesk.backend.meetings.persistence.TranscriptionQueueRepository;

/**
 * Persistent implementation of DesktopQueueService backed by PostgreSQL.
 * 
 * <p>Features:</p>
 * <ul>
 *   <li>Survives backend restarts</li>
 *   <li>Automatic retry for failed jobs</li>
 *   <li>Timeout detection for stalled jobs</li>
 *   <li>Cleanup of old completed jobs</li>
 * </ul>
 * 
 * <p>Configuration:</p>
 * <ul>
 *   <li>{@code transcription.desktop.enabled=true} - enable this service</li>
 *   <li>{@code transcription.desktop.job-timeout-minutes=30} - timeout for stalled jobs</li>
 *   <li>{@code transcription.desktop.max-retries=3} - max retry attempts</li>
 *   <li>{@code transcription.desktop.cleanup-retention-hours=24} - retention for completed jobs</li>
 * </ul>
 */
@Service
@ConditionalOnProperty(name = "transcription.desktop.enabled", havingValue = "true")
public class PersistentDesktopQueueService implements DesktopQueueService {

    private static final Logger log = LoggerFactory.getLogger(PersistentDesktopQueueService.class);

    private final TranscriptionQueueRepository queueRepository;
    private final AppProps appProps;

    // Configuration with defaults
    private static final int DEFAULT_JOB_TIMEOUT_MINUTES = 30;
    private static final int DEFAULT_MAX_RETRIES = 3;
    private static final int DEFAULT_CLEANUP_RETENTION_HOURS = 24;

    public PersistentDesktopQueueService(TranscriptionQueueRepository queueRepository,
                                          AppProps appProps) {
        this.queueRepository = queueRepository;
        this.appProps = appProps;
    }

    @Override
    @Transactional
    public void enqueue(DesktopTranscriptionJob job) {
        // Check if already queued
        Optional<TranscriptionQueueJob> existing = queueRepository.findByMeetingId(job.meetingId());
        if (existing.isPresent()) {
            log.warn("Meeting {} already in queue with status {}", 
                    job.meetingId(), existing.get().status());
            return;
        }

        TranscriptionQueueJob queueJob = TranscriptionQueueJob.create(
                job.meetingId(),
                job.audioPath().toString(),
                job.model(),
                job.language(),
                job.enableDiarization()
        );

        queueRepository.insert(queueJob);
        log.info("Job queued for desktop: meetingId={}, model={}", job.meetingId(), job.model());
    }

    @Override
    @Transactional(readOnly = true)
    public List<DesktopTranscriptionJob> getPendingJobs() {
        return queueRepository.findPending().stream()
                .map(this::toDesktopJob)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DesktopTranscriptionJob> getJob(UUID meetingId) {
        return queueRepository.findByMeetingId(meetingId)
                .map(this::toDesktopJob);
    }

    @Override
    @Transactional
    public void markAccepted(UUID meetingId) {
        TranscriptionQueueJob job = queueRepository.findByMeetingId(meetingId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + meetingId));
        
        if (job.status() != JobStatus.PENDING) {
            log.warn("Attempted to accept job in status {}: meetingId={}", job.status(), meetingId);
            return;
        }

        queueRepository.update(job.accept().startProcessing());
        log.info("Job accepted by desktop: meetingId={}", meetingId);
    }

    @Override
    @Transactional
    public void markCompleted(UUID meetingId) {
        TranscriptionQueueJob job = queueRepository.findByMeetingId(meetingId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + meetingId));

        queueRepository.update(job.complete());
        log.info("Job completed by desktop: meetingId={}", meetingId);
        
        // Cleanup immediately after completion
        queueRepository.delete(job.id());
    }

    @Override
    @Transactional
    public void markFailed(UUID meetingId, String error) {
        TranscriptionQueueJob job = queueRepository.findByMeetingId(meetingId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + meetingId));

        TranscriptionQueueJob failedJob = job.fail(error);
        queueRepository.update(failedJob);
        log.error("Job failed on desktop: meetingId={}, error={}, retries={}", 
                meetingId, error, failedJob.retryCount());

        // Check if can retry
        if (failedJob.canRetry(getMaxRetries())) {
            log.info("Job will be retried automatically: meetingId={}", meetingId);
        } else {
            log.warn("Job exceeded max retries ({}): meetingId={}", getMaxRetries(), meetingId);
        }
    }

    @Override
    @Transactional
    public void cancel(UUID meetingId) {
        TranscriptionQueueJob job = queueRepository.findByMeetingId(meetingId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + meetingId));

        queueRepository.update(job.cancel());
        log.info("Job cancelled: meetingId={}", meetingId);
        
        // Cleanup cancelled jobs immediately
        queueRepository.delete(job.id());
    }

    /**
     * Automatically retry failed jobs (runs every 5 minutes).
     */
    @Scheduled(fixedDelayString = "${transcription.desktop.retry-check-minutes:5}000", 
               initialDelay = 60000)
    @Transactional
    public void retryFailedJobs() {
        List<TranscriptionQueueJob> retryableJobs = queueRepository.findRetryable(getMaxRetries());
        
        if (retryableJobs.isEmpty()) {
            return;
        }

        log.info("Found {} jobs to retry", retryableJobs.size());
        
        for (TranscriptionQueueJob job : retryableJobs) {
            queueRepository.update(job.retry());
            log.info("Retrying job: meetingId={}, attempt={}", 
                    job.meetingId(), job.retryCount() + 1);
        }
    }

    /**
     * Timeout stalled jobs (runs every 10 minutes).
     */
    @Scheduled(fixedDelayString = "${transcription.desktop.timeout-check-minutes:10}000", 
               initialDelay = 120000)
    @Transactional
    public void timeoutStalledJobs() {
        OffsetDateTime timeoutBefore = OffsetDateTime.now()
                .minusMinutes(getJobTimeoutMinutes());
        
        List<TranscriptionQueueJob> timedOutJobs = queueRepository.findTimedOut(timeoutBefore);
        
        if (timedOutJobs.isEmpty()) {
            return;
        }

        log.warn("Found {} timed-out jobs", timedOutJobs.size());
        
        for (TranscriptionQueueJob job : timedOutJobs) {
            String error = String.format("Job timed out after %d minutes", getJobTimeoutMinutes());
            queueRepository.update(job.fail(error));
            log.error("Job timed out: meetingId={}, acceptedAt={}", 
                    job.meetingId(), job.acceptedAt());
        }
    }

    /**
     * Cleanup old completed/cancelled jobs (runs daily).
     */
    @Scheduled(cron = "${transcription.desktop.cleanup-cron:0 0 3 * * ?}")
    @Transactional
    public void cleanupOldJobs() {
        OffsetDateTime cleanupBefore = OffsetDateTime.now()
                .minusHours(getCleanupRetentionHours());
        
        int deleted = queueRepository.deleteCompleted(cleanupBefore);
        
        if (deleted > 0) {
            log.info("Cleaned up {} old jobs", deleted);
        }
    }

    /**
     * Log queue statistics (runs every hour).
     */
    @Scheduled(fixedDelayString = "${transcription.desktop.stats-log-minutes:60}000", 
               initialDelay = 300000)
    @Transactional(readOnly = true)
    public void logQueueStats() {
        long pending = queueRepository.countByStatus(JobStatus.PENDING);
        long processing = queueRepository.countByStatus(JobStatus.PROCESSING);
        long failed = queueRepository.countByStatus(JobStatus.FAILED);
        
        if (pending + processing + failed > 0) {
            log.info("Queue stats: pending={}, processing={}, failed={}", 
                    pending, processing, failed);
        }
    }

    private DesktopTranscriptionJob toDesktopJob(TranscriptionQueueJob job) {
        return new DesktopTranscriptionJob(
                job.meetingId(),
                Path.of(job.audioPath()),
                job.model(),
                job.language(),
                job.enableDiarization()
        );
    }

    private int getJobTimeoutMinutes() {
        // TODO: Add to AppProps if needed
        return DEFAULT_JOB_TIMEOUT_MINUTES;
    }

    private int getMaxRetries() {
        // TODO: Add to AppProps if needed
        return DEFAULT_MAX_RETRIES;
    }

    private int getCleanupRetentionHours() {
        // TODO: Add to AppProps if needed
        return DEFAULT_CLEANUP_RETENTION_HOURS;
    }
}
