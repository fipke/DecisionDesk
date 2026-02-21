package com.decisiondesk.backend.meetings.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.decisiondesk.backend.meetings.model.TranscriptSegment;

/**
 * Repository for transcript segment CRUD operations.
 */
@Repository
public class TranscriptSegmentRepository {

    private final JdbcClient jdbcClient;

    public TranscriptSegmentRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<TranscriptSegment> findByMeetingId(UUID meetingId) {
        return jdbcClient.sql("""
                SELECT id, meeting_id, ordinal, start_sec, end_sec, text, speaker_label, speaker_id, created_at
                FROM transcript_segments
                WHERE meeting_id = :meetingId
                ORDER BY ordinal
                """)
                .param("meetingId", meetingId)
                .query(this::mapRow)
                .list();
    }

    public Optional<TranscriptSegment> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, meeting_id, ordinal, start_sec, end_sec, text, speaker_label, speaker_id, created_at
                FROM transcript_segments WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapRow)
                .optional();
    }

    /**
     * Bulk inserts segments for a meeting. Typically called after transcription.
     */
    @Transactional
    public List<TranscriptSegment> insertBatch(UUID meetingId, List<TranscriptSegment> segments) {
        List<TranscriptSegment> inserted = new ArrayList<>(segments.size());
        for (TranscriptSegment seg : segments) {
            jdbcClient.sql("""
                    INSERT INTO transcript_segments (id, meeting_id, ordinal, start_sec, end_sec, text, speaker_label, speaker_id)
                    VALUES (:id, :meetingId, :ordinal, :startSec, :endSec, :text, :speakerLabel, :speakerId)
                    ON CONFLICT (meeting_id, ordinal) DO UPDATE SET
                        start_sec = EXCLUDED.start_sec,
                        end_sec = EXCLUDED.end_sec,
                        text = EXCLUDED.text,
                        speaker_label = EXCLUDED.speaker_label,
                        speaker_id = EXCLUDED.speaker_id
                    """)
                    .param("id", seg.id())
                    .param("meetingId", meetingId)
                    .param("ordinal", seg.ordinal())
                    .param("startSec", seg.startSec())
                    .param("endSec", seg.endSec())
                    .param("text", seg.text())
                    .param("speakerLabel", seg.speakerLabel())
                    .param("speakerId", seg.speakerId())
                    .update();
            inserted.add(seg);
        }
        return inserted;
    }

    /**
     * Deletes all segments for a meeting (used before re-import).
     */
    public void deleteByMeetingId(UUID meetingId) {
        jdbcClient.sql("DELETE FROM transcript_segments WHERE meeting_id = :meetingId")
                .param("meetingId", meetingId)
                .update();
    }

    /**
     * Updates the speaker assignment for a single segment.
     */
    public void updateSpeaker(UUID segmentId, UUID speakerId, String speakerLabel) {
        jdbcClient.sql("""
                UPDATE transcript_segments
                SET speaker_id = :speakerId, speaker_label = :speakerLabel
                WHERE id = :segmentId
                """)
                .param("segmentId", segmentId)
                .param("speakerId", speakerId)
                .param("speakerLabel", speakerLabel)
                .update();
    }

    private TranscriptSegment mapRow(ResultSet rs, int rowNum) throws SQLException {
        UUID speakerId = rs.getObject("speaker_id", UUID.class);
        return new TranscriptSegment(
            rs.getObject("id", UUID.class),
            rs.getObject("meeting_id", UUID.class),
            rs.getInt("ordinal"),
            rs.getDouble("start_sec"),
            rs.getDouble("end_sec"),
            rs.getString("text"),
            rs.getString("speaker_label"),
            speakerId,
            rs.getObject("created_at", OffsetDateTime.class)
        );
    }
}
