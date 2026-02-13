package com.decisiondesk.backend.notes.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.notes.model.UserPreference;

/**
 * Repository for user preferences CRUD operations.
 */
@Repository
public class UserPreferenceRepository {

    private final JdbcClient jdbcClient;

    public UserPreferenceRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public UserPreference create(UserPreference preference) {
        jdbcClient.sql("""
                INSERT INTO user_preferences (id, user_id, default_language, notes_template)
                VALUES (:id, :userId, :defaultLanguage, :notesTemplate)
                """)
                .param("id", preference.id())
                .param("userId", preference.userId())
                .param("defaultLanguage", preference.defaultLanguage())
                .param("notesTemplate", preference.notesTemplate())
                .update();
        return findById(preference.id()).orElseThrow();
    }

    public Optional<UserPreference> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, user_id, default_language, notes_template, created_at, updated_at
                FROM user_preferences WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapPreference)
                .optional();
    }

    public Optional<UserPreference> findByUserId(String userId) {
        return jdbcClient.sql("""
                SELECT id, user_id, default_language, notes_template, created_at, updated_at
                FROM user_preferences WHERE user_id = :userId
                """)
                .param("userId", userId)
                .query(this::mapPreference)
                .optional();
    }

    public UserPreference upsert(UserPreference preference) {
        jdbcClient.sql("""
                INSERT INTO user_preferences (id, user_id, default_language, notes_template)
                VALUES (:id, :userId, :defaultLanguage, :notesTemplate)
                ON CONFLICT (user_id) DO UPDATE SET
                    default_language = EXCLUDED.default_language,
                    notes_template = EXCLUDED.notes_template,
                    updated_at = NOW()
                """)
                .param("id", preference.id())
                .param("userId", preference.userId())
                .param("defaultLanguage", preference.defaultLanguage())
                .param("notesTemplate", preference.notesTemplate())
                .update();
        return findByUserId(preference.userId()).orElseThrow();
    }

    private UserPreference mapPreference(ResultSet rs, int rowNum) throws SQLException {
        return new UserPreference(
            rs.getObject("id", UUID.class),
            rs.getString("user_id"),
            rs.getString("default_language"),
            rs.getString("notes_template"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}
