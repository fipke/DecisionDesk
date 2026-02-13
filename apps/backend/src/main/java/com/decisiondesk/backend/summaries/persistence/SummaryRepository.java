package com.decisiondesk.backend.summaries.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.summaries.model.Summary;

/**
 * Repository for meeting summary CRUD operations.
 */
@Repository("summariesSummaryRepository")
public class SummaryRepository {

    private final JdbcClient jdbcClient;

    public SummaryRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Summary create(Summary summary) {
        jdbcClient.sql("""
                INSERT INTO summaries (id, meeting_id, text_md, template_id, model, tokens_used)
                VALUES (:id, :meetingId, :textMd, :templateId, :model, :tokensUsed)
                """)
                .param("id", summary.id())
                .param("meetingId", summary.meetingId())
                .param("textMd", summary.textMd())
                .param("templateId", summary.templateId())
                .param("model", summary.model())
                .param("tokensUsed", summary.tokensUsed())
                .update();
        return findById(summary.id()).orElseThrow();
    }

    public Optional<Summary> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, meeting_id, text_md, template_id, model, tokens_used, created_at, updated_at
                FROM summaries WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapSummary)
                .optional();
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

    public Summary upsert(Summary summary) {
        jdbcClient.sql("""
                INSERT INTO summaries (id, meeting_id, text_md, template_id, model, tokens_used)
                VALUES (:id, :meetingId, :textMd, :templateId, :model, :tokensUsed)
                ON CONFLICT (meeting_id) DO UPDATE SET
                    text_md = EXCLUDED.text_md,
                    template_id = EXCLUDED.template_id,
                    model = EXCLUDED.model,
                    tokens_used = EXCLUDED.tokens_used,
                    updated_at = NOW()
                """)
                .param("id", summary.id())
                .param("meetingId", summary.meetingId())
                .param("textMd", summary.textMd())
                .param("templateId", summary.templateId())
                .param("model", summary.model())
                .param("tokensUsed", summary.tokensUsed())
                .update();
        return findByMeetingId(summary.meetingId()).orElseThrow();
    }

    public boolean delete(UUID meetingId) {
        int rows = jdbcClient.sql("DELETE FROM summaries WHERE meeting_id = :meetingId")
                .param("meetingId", meetingId)
                .update();
        return rows > 0;
    }

    private Summary mapSummary(ResultSet rs, int rowNum) throws SQLException {
        return new Summary(
            rs.getObject("id", UUID.class),
            rs.getObject("meeting_id", UUID.class),
            rs.getString("text_md"),
            rs.getObject("template_id", UUID.class),
            rs.getString("model"),
            rs.getObject("tokens_used") != null ? rs.getInt("tokens_used") : null,
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}
