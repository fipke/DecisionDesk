package com.decisiondesk.backend.meetingtypes.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.meetingtypes.model.MeetingType;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Repository responsible for CRUD interactions with the {@code meeting_types} table.
 */
@Repository
public class MeetingTypeRepository {

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    public MeetingTypeRepository(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Creates a new meeting type.
     *
     * @param meetingType the meeting type to persist
     * @return the persisted meeting type
     */
    public MeetingType create(MeetingType meetingType) {
        jdbcClient.sql("""
                INSERT INTO meeting_types (id, name, description, required_tags, default_whisper_model, summary_template_id)
                VALUES (:id, :name, :description, :requiredTags::jsonb, :defaultWhisperModel, :summaryTemplateId)
                """)
                .param("id", meetingType.id())
                .param("name", meetingType.name())
                .param("description", meetingType.description())
                .param("requiredTags", toJson(meetingType.requiredTags()))
                .param("defaultWhisperModel", meetingType.defaultWhisperModel())
                .param("summaryTemplateId", meetingType.summaryTemplateId())
                .update();
        return findById(meetingType.id()).orElseThrow();
    }

    /**
     * Finds a meeting type by identifier.
     *
     * @param id target meeting type
     * @return optional meeting type
     */
    public Optional<MeetingType> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, name, description, required_tags, default_whisper_model, 
                       summary_template_id, created_at 
                FROM meeting_types WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapMeetingType)
                .optional();
    }

    /**
     * Finds a meeting type by name.
     *
     * @param name the meeting type name
     * @return optional meeting type
     */
    public Optional<MeetingType> findByName(String name) {
        return jdbcClient.sql("""
                SELECT id, name, description, required_tags, default_whisper_model, 
                       summary_template_id, created_at 
                FROM meeting_types WHERE name = :name
                """)
                .param("name", name)
                .query(this::mapMeetingType)
                .optional();
    }

    /**
     * Returns all meeting types.
     *
     * @return list of all meeting types
     */
    public List<MeetingType> findAll() {
        return jdbcClient.sql("""
                SELECT id, name, description, required_tags, default_whisper_model, 
                       summary_template_id, created_at 
                FROM meeting_types ORDER BY name
                """)
                .query(this::mapMeetingType)
                .list();
    }

    /**
     * Updates a meeting type.
     *
     * @param meetingType the meeting type with updated values
     * @return number of rows updated
     */
    public int update(MeetingType meetingType) {
        return jdbcClient.sql("""
                UPDATE meeting_types SET 
                    name = :name, 
                    description = :description,
                    required_tags = :requiredTags::jsonb, 
                    default_whisper_model = :defaultWhisperModel,
                    summary_template_id = :summaryTemplateId
                WHERE id = :id
                """)
                .param("id", meetingType.id())
                .param("name", meetingType.name())
                .param("description", meetingType.description())
                .param("requiredTags", toJson(meetingType.requiredTags()))
                .param("defaultWhisperModel", meetingType.defaultWhisperModel())
                .param("summaryTemplateId", meetingType.summaryTemplateId())
                .update();
    }

    /**
     * Deletes a meeting type by id.
     *
     * @param id meeting type identifier
     * @return number of rows deleted
     */
    public int deleteById(UUID id) {
        return jdbcClient.sql("DELETE FROM meeting_types WHERE id = :id")
                .param("id", id)
                .update();
    }

    private MeetingType mapMeetingType(ResultSet rs, int rowNum) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        String name = rs.getString("name");
        String description = rs.getString("description");
        Map<String, String> requiredTags = fromJson(rs.getString("required_tags"));
        String defaultWhisperModel = rs.getString("default_whisper_model");
        UUID summaryTemplateId = rs.getObject("summary_template_id", UUID.class);
        OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);
        
        return new MeetingType(id, name, description, requiredTags, defaultWhisperModel, 
                              summaryTemplateId, createdAt);
    }

    private String toJson(Map<String, String> map) {
        try {
            return objectMapper.writeValueAsString(map != null ? map : Map.of());
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private Map<String, String> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }
}
