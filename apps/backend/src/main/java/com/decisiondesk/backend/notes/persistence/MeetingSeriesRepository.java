package com.decisiondesk.backend.notes.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.notes.model.MeetingSeries;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Repository for meeting series CRUD operations.
 */
@Repository
public class MeetingSeriesRepository {

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    public MeetingSeriesRepository(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    public MeetingSeries create(MeetingSeries series) {
        jdbcClient.sql("""
                INSERT INTO meeting_series 
                (id, name, description, recurrence_rule, default_folder_id, default_type_id, default_tags)
                VALUES (:id, :name, :description, :recurrenceRule, :defaultFolderId, :defaultTypeId, :defaultTags::jsonb)
                """)
                .param("id", series.id())
                .param("name", series.name())
                .param("description", series.description())
                .param("recurrenceRule", series.recurrenceRule())
                .param("defaultFolderId", series.defaultFolderId())
                .param("defaultTypeId", series.defaultTypeId())
                .param("defaultTags", toJson(series.defaultTags()))
                .update();
        return findById(series.id()).orElseThrow();
    }

    public Optional<MeetingSeries> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, name, description, recurrence_rule, default_folder_id, default_type_id, 
                       default_tags::text, created_at, updated_at
                FROM meeting_series WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapSeries)
                .optional();
    }

    public List<MeetingSeries> findAll() {
        return jdbcClient.sql("""
                SELECT id, name, description, recurrence_rule, default_folder_id, default_type_id,
                       default_tags::text, created_at, updated_at
                FROM meeting_series ORDER BY name
                """)
                .query(this::mapSeries)
                .list();
    }

    public MeetingSeries update(MeetingSeries series) {
        jdbcClient.sql("""
                UPDATE meeting_series SET
                    name = :name,
                    description = :description,
                    recurrence_rule = :recurrenceRule,
                    default_folder_id = :defaultFolderId,
                    default_type_id = :defaultTypeId,
                    default_tags = :defaultTags::jsonb,
                    updated_at = NOW()
                WHERE id = :id
                """)
                .param("id", series.id())
                .param("name", series.name())
                .param("description", series.description())
                .param("recurrenceRule", series.recurrenceRule())
                .param("defaultFolderId", series.defaultFolderId())
                .param("defaultTypeId", series.defaultTypeId())
                .param("defaultTags", toJson(series.defaultTags()))
                .update();
        return findById(series.id()).orElseThrow();
    }

    public boolean delete(UUID id) {
        int rows = jdbcClient.sql("DELETE FROM meeting_series WHERE id = :id")
                .param("id", id)
                .update();
        return rows > 0;
    }

    private MeetingSeries mapSeries(ResultSet rs, int rowNum) throws SQLException {
        return new MeetingSeries(
            rs.getObject("id", UUID.class),
            rs.getString("name"),
            rs.getString("description"),
            rs.getString("recurrence_rule"),
            rs.getObject("default_folder_id", UUID.class),
            rs.getObject("default_type_id", UUID.class),
            fromJson(rs.getString("default_tags")),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        );
    }

    private String toJson(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list != null ? list : List.of());
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private List<String> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }
}
