package com.decisiondesk.backend.notes.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.notes.model.NotesTemplate;

/**
 * Repository for notes template CRUD operations.
 */
@Repository
public class NotesTemplateRepository {

    private final JdbcClient jdbcClient;

    public NotesTemplateRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public NotesTemplate create(NotesTemplate template) {
        jdbcClient.sql("""
                INSERT INTO notes_templates (id, language, name, template, is_default)
                VALUES (:id, :language, :name, :template, :isDefault)
                """)
                .param("id", template.id())
                .param("language", template.language())
                .param("name", template.name())
                .param("template", template.template())
                .param("isDefault", template.isDefault())
                .update();
        return findById(template.id()).orElseThrow();
    }

    public Optional<NotesTemplate> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, language, name, template, is_default, created_at, updated_at
                FROM notes_templates WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapTemplate)
                .optional();
    }

    public List<NotesTemplate> findByLanguage(String language) {
        return jdbcClient.sql("""
                SELECT id, language, name, template, is_default, created_at, updated_at
                FROM notes_templates WHERE language = :language ORDER BY is_default DESC, name
                """)
                .param("language", language)
                .query(this::mapTemplate)
                .list();
    }

    public Optional<NotesTemplate> findDefaultByLanguage(String language) {
        return jdbcClient.sql("""
                SELECT id, language, name, template, is_default, created_at, updated_at
                FROM notes_templates WHERE language = :language AND is_default = TRUE LIMIT 1
                """)
                .param("language", language)
                .query(this::mapTemplate)
                .optional();
    }

    public List<NotesTemplate> findAll() {
        return jdbcClient.sql("""
                SELECT id, language, name, template, is_default, created_at, updated_at
                FROM notes_templates ORDER BY language, is_default DESC, name
                """)
                .query(this::mapTemplate)
                .list();
    }

    public NotesTemplate update(NotesTemplate template) {
        jdbcClient.sql("""
                UPDATE notes_templates SET
                    name = :name,
                    template = :template,
                    is_default = :isDefault,
                    updated_at = NOW()
                WHERE id = :id
                """)
                .param("id", template.id())
                .param("name", template.name())
                .param("template", template.template())
                .param("isDefault", template.isDefault())
                .update();
        return findById(template.id()).orElseThrow();
    }

    public boolean delete(UUID id) {
        int rows = jdbcClient.sql("DELETE FROM notes_templates WHERE id = :id")
                .param("id", id)
                .update();
        return rows > 0;
    }

    private NotesTemplate mapTemplate(ResultSet rs, int rowNum) throws SQLException {
        return new NotesTemplate(
            rs.getObject("id", UUID.class),
            rs.getString("language"),
            rs.getString("name"),
            rs.getString("template"),
            rs.getBoolean("is_default"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}
