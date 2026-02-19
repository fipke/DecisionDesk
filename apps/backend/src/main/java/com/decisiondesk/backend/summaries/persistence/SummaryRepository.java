package com.decisiondesk.backend.summaries.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.summaries.model.Summary;

/**
 * Repository for meeting summary CRUD operations.
 * Supports multiple summaries per meeting (one per template).
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
                ORDER BY created_at ASC LIMIT 1
                """)
                .param("meetingId", meetingId)
                .query(this::mapSummary)
                .optional();
    }

    public List<Summary> findAllByMeetingId(UUID meetingId) {
        return jdbcClient.sql("""
                SELECT id, meeting_id, text_md, template_id, model, tokens_used, created_at, updated_at
                FROM summaries WHERE meeting_id = :meetingId
                ORDER BY created_at ASC
                """)
                .param("meetingId", meetingId)
                .query(this::mapSummary)
                .list();
    }

    public Optional<Summary> findByMeetingIdAndTemplateId(UUID meetingId, UUID templateId) {
        if (templateId == null) {
            return jdbcClient.sql("""
                    SELECT id, meeting_id, text_md, template_id, model, tokens_used, created_at, updated_at
                    FROM summaries WHERE meeting_id = :meetingId AND template_id IS NULL
                    """)
                    .param("meetingId", meetingId)
                    .query(this::mapSummary)
                    .optional();
        }
        return jdbcClient.sql("""
                SELECT id, meeting_id, text_md, template_id, model, tokens_used, created_at, updated_at
                FROM summaries WHERE meeting_id = :meetingId AND template_id = :templateId
                """)
                .param("meetingId", meetingId)
                .param("templateId", templateId)
                .query(this::mapSummary)
                .optional();
    }

    /**
     * Upserts a summary using the composite key (meeting_id + template_id).
     * Re-generating the same template for a meeting overwrites the previous result.
     */
    public Summary upsert(Summary summary) {
        // Use two-step approach: try update first, then insert if no rows affected
        if (summary.templateId() != null) {
            int updated = jdbcClient.sql("""
                    UPDATE summaries SET
                        text_md = :textMd,
                        model = :model,
                        tokens_used = :tokensUsed,
                        updated_at = NOW()
                    WHERE meeting_id = :meetingId AND template_id = :templateId
                    """)
                    .param("textMd", summary.textMd())
                    .param("model", summary.model())
                    .param("tokensUsed", summary.tokensUsed())
                    .param("meetingId", summary.meetingId())
                    .param("templateId", summary.templateId())
                    .update();
            if (updated > 0) {
                return findByMeetingIdAndTemplateId(summary.meetingId(), summary.templateId()).orElseThrow();
            }
        } else {
            int updated = jdbcClient.sql("""
                    UPDATE summaries SET
                        text_md = :textMd,
                        model = :model,
                        tokens_used = :tokensUsed,
                        updated_at = NOW()
                    WHERE meeting_id = :meetingId AND template_id IS NULL
                    """)
                    .param("textMd", summary.textMd())
                    .param("model", summary.model())
                    .param("tokensUsed", summary.tokensUsed())
                    .param("meetingId", summary.meetingId())
                    .update();
            if (updated > 0) {
                return findByMeetingIdAndTemplateId(summary.meetingId(), null).orElseThrow();
            }
        }
        return create(summary);
    }

    public boolean deleteById(UUID summaryId) {
        int rows = jdbcClient.sql("DELETE FROM summaries WHERE id = :id")
                .param("id", summaryId)
                .update();
        return rows > 0;
    }

    public boolean deleteAllByMeetingId(UUID meetingId) {
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
