package com.decisiondesk.backend.meetings.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.meetings.model.Summary;

/**
 * Read-only access to meeting summaries for MeetingService.
 */
@Repository("meetingsSummaryRepository")
public class SummaryRepository {

    private final JdbcClient jdbcClient;

    public SummaryRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<Summary> findByMeetingId(UUID meetingId) {
        return jdbcClient.sql("""
                SELECT id, meeting_id, text_md, template_id, model, tokens_used, created_at, updated_at 
                FROM summaries WHERE meeting_id = :meetingId
                """)
                .param("meetingId", meetingId)
                .query(this::mapSummary)
                .optional();
    }

    private Summary mapSummary(ResultSet rs, int rowNum) throws SQLException {
        return new Summary(
                rs.getObject("id", UUID.class),
                rs.getObject("meeting_id", UUID.class),
                rs.getString("text_md"),
                rs.getObject("template_id", UUID.class),
                rs.getString("model"),
                (Integer) rs.getObject("tokens_used"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class));
    }
}

