package com.decisiondesk.backend.meetings.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.meetings.model.Transcript;

/**
 * JDBC-backed repository for the {@code transcripts} table.
 */
@Repository
public class TranscriptRepository {

    private final JdbcClient jdbcClient;

    public TranscriptRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * Inserts or updates the transcript associated with the meeting.
     *
     * @param transcript transcript payload to persist
     */
    public void upsert(Transcript transcript) {
        jdbcClient.sql("""
                INSERT INTO transcripts (id, meeting_id, language, text)
                VALUES (:id, :meetingId, :language, :text)
                ON CONFLICT (meeting_id) DO UPDATE SET
                    language = EXCLUDED.language,
                    text = EXCLUDED.text,
                    created_at = now()
                """)
                .param("id", transcript.id())
                .param("meetingId", transcript.meetingId())
                .param("language", transcript.language())
                .param("text", transcript.text())
                .update();
    }

    /**
     * Fetches the transcript for a meeting if one exists.
     */
    public Optional<Transcript> findByMeetingId(UUID meetingId) {
        return jdbcClient.sql("SELECT id, meeting_id, language, text, created_at FROM transcripts WHERE meeting_id = :meetingId")
                .param("meetingId", meetingId)
                .query(this::mapTranscript)
                .optional();
    }

    private Transcript mapTranscript(ResultSet rs, int rowNum) throws SQLException {
        return new Transcript(
                rs.getObject("id", UUID.class),
                rs.getObject("meeting_id", UUID.class),
                rs.getString("language"),
                rs.getString("text"),
                rs.getObject("created_at", OffsetDateTime.class));
    }
}
