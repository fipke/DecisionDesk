package com.decisiondesk.backend.summaries.persistence;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.summaries.model.SummaryTemplate;

/**
 * Repository for summary template CRUD operations.
 */
@Repository
public class SummaryTemplateRepository {

    private final JdbcClient jdbcClient;

    public SummaryTemplateRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public SummaryTemplate create(SummaryTemplate template) {
        jdbcClient.sql("""
                INSERT INTO summary_templates 
                (id, name, description, system_prompt, user_prompt_template, output_format, 
                 model, max_tokens, temperature, is_default)
                VALUES (:id, :name, :description, :systemPrompt, :userPromptTemplate, :outputFormat,
                        :model, :maxTokens, :temperature, :isDefault)
                """)
                .param("id", template.id())
                .param("name", template.name())
                .param("description", template.description())
                .param("systemPrompt", template.systemPrompt())
                .param("userPromptTemplate", template.userPromptTemplate())
                .param("outputFormat", template.outputFormat())
                .param("model", template.model())
                .param("maxTokens", template.maxTokens())
                .param("temperature", template.temperature())
                .param("isDefault", template.isDefault())
                .update();
        return findById(template.id()).orElseThrow();
    }

    public Optional<SummaryTemplate> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, name, description, system_prompt, user_prompt_template, output_format,
                       model, max_tokens, temperature, is_default, created_at, updated_at
                FROM summary_templates WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapTemplate)
                .optional();
    }

    public List<SummaryTemplate> findAll() {
        return jdbcClient.sql("""
                SELECT id, name, description, system_prompt, user_prompt_template, output_format,
                       model, max_tokens, temperature, is_default, created_at, updated_at
                FROM summary_templates ORDER BY is_default DESC, name
                """)
                .query(this::mapTemplate)
                .list();
    }

    public Optional<SummaryTemplate> findDefault() {
        return jdbcClient.sql("""
                SELECT id, name, description, system_prompt, user_prompt_template, output_format,
                       model, max_tokens, temperature, is_default, created_at, updated_at
                FROM summary_templates WHERE is_default = TRUE LIMIT 1
                """)
                .query(this::mapTemplate)
                .optional();
    }

    public SummaryTemplate update(SummaryTemplate template) {
        jdbcClient.sql("""
                UPDATE summary_templates SET
                    name = :name,
                    description = :description,
                    system_prompt = :systemPrompt,
                    user_prompt_template = :userPromptTemplate,
                    output_format = :outputFormat,
                    model = :model,
                    max_tokens = :maxTokens,
                    temperature = :temperature,
                    is_default = :isDefault,
                    updated_at = NOW()
                WHERE id = :id
                """)
                .param("id", template.id())
                .param("name", template.name())
                .param("description", template.description())
                .param("systemPrompt", template.systemPrompt())
                .param("userPromptTemplate", template.userPromptTemplate())
                .param("outputFormat", template.outputFormat())
                .param("model", template.model())
                .param("maxTokens", template.maxTokens())
                .param("temperature", template.temperature())
                .param("isDefault", template.isDefault())
                .update();
        return findById(template.id()).orElseThrow();
    }

    public boolean delete(UUID id) {
        int rows = jdbcClient.sql("DELETE FROM summary_templates WHERE id = :id")
                .param("id", id)
                .update();
        return rows > 0;
    }

    /**
     * Sets a template as the default, unsetting any previous default.
     */
    public void setAsDefault(UUID templateId) {
        // Unset current default
        jdbcClient.sql("UPDATE summary_templates SET is_default = FALSE WHERE is_default = TRUE")
                .update();
        // Set new default
        jdbcClient.sql("UPDATE summary_templates SET is_default = TRUE, updated_at = NOW() WHERE id = :id")
                .param("id", templateId)
                .update();
    }

    private SummaryTemplate mapTemplate(ResultSet rs, int rowNum) throws SQLException {
        return new SummaryTemplate(
            rs.getObject("id", UUID.class),
            rs.getString("name"),
            rs.getString("description"),
            rs.getString("system_prompt"),
            rs.getString("user_prompt_template"),
            rs.getString("output_format"),
            rs.getString("model"),
            rs.getInt("max_tokens"),
            rs.getBigDecimal("temperature"),
            rs.getBoolean("is_default"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}
