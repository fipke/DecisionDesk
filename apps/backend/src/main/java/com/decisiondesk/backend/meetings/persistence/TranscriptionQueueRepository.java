package com.decisiondesk.backend.meetings.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.meetings.WhisperModel;
import com.decisiondesk.backend.meetings.model.TranscriptionQueueJob;
import com.decisiondesk.backend.meetings.model.TranscriptionQueueJob.JobStatus;

/**
 * Repository for transcription queue operations.
 */
@Repository
public class TranscriptionQueueRepository {

    private final JdbcClient jdbcClient;
    private final TranscriptionQueueRowMapper rowMapper = new TranscriptionQueueRowMapper();

    public TranscriptionQueueRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * Insert a new job into the queue.
     */
    public void insert(TranscriptionQueueJob job) {
        jdbcClient.sql("""
                INSERT INTO transcription_queue 
                (id, meeting_id, audio_path, model, language, enable_diarization, 
                 status, accepted_at, completed_at, error_message, retry_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?::VARCHAR, ?, ?, ?, ?, ?, ?)
                """)
                .params(job.id(), job.meetingId(), job.audioPath(), job.model().getValue(),
                        job.language(), job.enableDiarization(), job.status().name(),
                        job.acceptedAt(), job.completedAt(), job.errorMessage(),
                        job.retryCount(), job.createdAt(), job.updatedAt())
                .update();
    }

    /**
     * Update an existing job.
     */
    public void update(TranscriptionQueueJob job) {
        jdbcClient.sql("""
                UPDATE transcription_queue 
                SET status = ?::VARCHAR, accepted_at = ?, completed_at = ?, 
                    error_message = ?, retry_count = ?
                WHERE id = ?
                """)
                .params(job.status().name(), job.acceptedAt(), job.completedAt(),
                        job.errorMessage(), job.retryCount(), job.id())
                .update();
    }

    /**
     * Find job by meeting ID.
     */
    public Optional<TranscriptionQueueJob> findByMeetingId(UUID meetingId) {
        return jdbcClient.sql("""
                SELECT * FROM transcription_queue WHERE meeting_id = ?
                """)
                .param(meetingId)
                .query(rowMapper)
                .optional();
    }

    /**
     * Find job by ID.
     */
    public Optional<TranscriptionQueueJob> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT * FROM transcription_queue WHERE id = ?
                """)
                .param(id)
                .query(rowMapper)
                .optional();
    }

    /**
     * Get all pending jobs.
     */
    public List<TranscriptionQueueJob> findPending() {
        return jdbcClient.sql("""
                SELECT * FROM transcription_queue 
                WHERE status = 'PENDING' 
                ORDER BY created_at
                """)
                .query(rowMapper)
                .list();
    }

    /**
     * Get all jobs that can be retried.
     */
    public List<TranscriptionQueueJob> findRetryable(int maxRetries) {
        return jdbcClient.sql("""
                SELECT * FROM transcription_queue 
                WHERE status = 'FAILED' AND retry_count < ?
                ORDER BY created_at
                """)
                .param(maxRetries)
                .query(rowMapper)
                .list();
    }

    /**
     * Get all accepted jobs older than timeout.
     */
    public List<TranscriptionQueueJob> findTimedOut(OffsetDateTime timeoutBefore) {
        return jdbcClient.sql("""
                SELECT * FROM transcription_queue 
                WHERE status IN ('ACCEPTED', 'PROCESSING') 
                  AND accepted_at < ?
                ORDER BY accepted_at
                """)
                .param(timeoutBefore)
                .query(rowMapper)
                .list();
    }

    /**
     * Delete a job.
     */
    public void delete(UUID id) {
        jdbcClient.sql("DELETE FROM transcription_queue WHERE id = ?")
                .param(id)
                .update();
    }

    /**
     * Delete completed jobs older than retention period.
     */
    public int deleteCompleted(OffsetDateTime before) {
        return jdbcClient.sql("""
                DELETE FROM transcription_queue 
                WHERE status IN ('COMPLETED', 'CANCELLED') 
                  AND completed_at < ?
                """)
                .param(before)
                .update();
    }

    /**
     * Count jobs by status.
     */
    public long countByStatus(JobStatus status) {
        Long count = jdbcClient.sql("""
                SELECT COUNT(*) FROM transcription_queue WHERE status = ?::VARCHAR
                """)
                .param(status.name())
                .query(Long.class)
                .single();
        return count != null ? count : 0;
    }

    private static class TranscriptionQueueRowMapper implements RowMapper<TranscriptionQueueJob> {
        @Override
        public TranscriptionQueueJob mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new TranscriptionQueueJob(
                    UUID.fromString(rs.getString("id")),
                    UUID.fromString(rs.getString("meeting_id")),
                    rs.getString("audio_path"),
                    WhisperModel.fromValue(rs.getString("model")),
                    rs.getString("language"),
                    rs.getBoolean("enable_diarization"),
                    JobStatus.valueOf(rs.getString("status")),
                    rs.getObject("accepted_at", OffsetDateTime.class),
                    rs.getObject("completed_at", OffsetDateTime.class),
                    rs.getString("error_message"),
                    rs.getInt("retry_count"),
                    rs.getObject("created_at", OffsetDateTime.class),
                    rs.getObject("updated_at", OffsetDateTime.class)
            );
        }
    }
}
