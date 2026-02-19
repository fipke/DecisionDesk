package com.decisiondesk.backend.meetingtypes.persistence;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Arrays;
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

    private static final String SELECT_FIELDS = """
            SELECT id, name, description, required_tags, default_whisper_model,
                   summary_template_id, summary_template_ids, extraction_config,
                   ai_provider, default_participants, icon, color, created_at
            """;

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    public MeetingTypeRepository(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    public MeetingType create(MeetingType meetingType) {
        jdbcClient.sql("""
                INSERT INTO meeting_types (id, name, description, required_tags, default_whisper_model,
                    summary_template_id, summary_template_ids, extraction_config,
                    ai_provider, default_participants, icon, color)
                VALUES (:id, :name, :description, :requiredTags::jsonb, :defaultWhisperModel,
                    :summaryTemplateId, :summaryTemplateIds, :extractionConfig::jsonb,
                    :aiProvider, :defaultParticipants, :icon, :color)
                """)
                .param("id", meetingType.id())
                .param("name", meetingType.name())
                .param("description", meetingType.description())
                .param("requiredTags", toJsonStringMap(meetingType.requiredTags()))
                .param("defaultWhisperModel", meetingType.defaultWhisperModel())
                .param("summaryTemplateId", meetingType.summaryTemplateId())
                .param("summaryTemplateIds", toUuidArray(meetingType.summaryTemplateIds()))
                .param("extractionConfig", toJsonObjectMap(meetingType.extractionConfig()))
                .param("aiProvider", meetingType.aiProvider())
                .param("defaultParticipants", toUuidArray(meetingType.defaultParticipants()))
                .param("icon", meetingType.icon())
                .param("color", meetingType.color())
                .update();
        return findById(meetingType.id()).orElseThrow();
    }

    public Optional<MeetingType> findById(UUID id) {
        return jdbcClient.sql(SELECT_FIELDS + " FROM meeting_types WHERE id = :id")
                .param("id", id)
                .query(this::mapMeetingType)
                .optional();
    }

    public Optional<MeetingType> findByName(String name) {
        return jdbcClient.sql(SELECT_FIELDS + " FROM meeting_types WHERE name = :name")
                .param("name", name)
                .query(this::mapMeetingType)
                .optional();
    }

    public List<MeetingType> findAll() {
        return jdbcClient.sql(SELECT_FIELDS + " FROM meeting_types ORDER BY name")
                .query(this::mapMeetingType)
                .list();
    }

    public int update(MeetingType meetingType) {
        return jdbcClient.sql("""
                UPDATE meeting_types SET
                    name = :name,
                    description = :description,
                    required_tags = :requiredTags::jsonb,
                    default_whisper_model = :defaultWhisperModel,
                    summary_template_id = :summaryTemplateId,
                    summary_template_ids = :summaryTemplateIds,
                    extraction_config = :extractionConfig::jsonb,
                    ai_provider = :aiProvider,
                    default_participants = :defaultParticipants,
                    icon = :icon,
                    color = :color
                WHERE id = :id
                """)
                .param("id", meetingType.id())
                .param("name", meetingType.name())
                .param("description", meetingType.description())
                .param("requiredTags", toJsonStringMap(meetingType.requiredTags()))
                .param("defaultWhisperModel", meetingType.defaultWhisperModel())
                .param("summaryTemplateId", meetingType.summaryTemplateId())
                .param("summaryTemplateIds", toUuidArray(meetingType.summaryTemplateIds()))
                .param("extractionConfig", toJsonObjectMap(meetingType.extractionConfig()))
                .param("aiProvider", meetingType.aiProvider())
                .param("defaultParticipants", toUuidArray(meetingType.defaultParticipants()))
                .param("icon", meetingType.icon())
                .param("color", meetingType.color())
                .update();
    }

    public int deleteById(UUID id) {
        return jdbcClient.sql("DELETE FROM meeting_types WHERE id = :id")
                .param("id", id)
                .update();
    }

    private MeetingType mapMeetingType(ResultSet rs, int rowNum) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        String name = rs.getString("name");
        String description = rs.getString("description");
        Map<String, String> requiredTags = fromJsonStringMap(rs.getString("required_tags"));
        String defaultWhisperModel = rs.getString("default_whisper_model");
        UUID summaryTemplateId = rs.getObject("summary_template_id", UUID.class);
        List<UUID> summaryTemplateIds = fromUuidArray(rs.getArray("summary_template_ids"));
        Map<String, Object> extractionConfig = fromJsonObjectMap(rs.getString("extraction_config"));
        String aiProvider = rs.getString("ai_provider");
        List<UUID> defaultParticipants = fromUuidArray(rs.getArray("default_participants"));
        String icon = rs.getString("icon");
        String color = rs.getString("color");
        OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);

        return new MeetingType(id, name, description, requiredTags, defaultWhisperModel,
                summaryTemplateId, summaryTemplateIds, extractionConfig, aiProvider,
                defaultParticipants, icon, color, createdAt);
    }

    private UUID[] toUuidArray(List<UUID> list) {
        if (list == null || list.isEmpty()) return new UUID[0];
        return list.toArray(new UUID[0]);
    }

    private List<UUID> fromUuidArray(Array sqlArray) throws SQLException {
        if (sqlArray == null) return List.of();
        Object[] arr = (Object[]) sqlArray.getArray();
        if (arr == null || arr.length == 0) return List.of();
        return Arrays.stream(arr)
                .map(o -> (UUID) o)
                .toList();
    }

    private String toJsonStringMap(Map<String, String> map) {
        try {
            return objectMapper.writeValueAsString(map != null ? map : Map.of());
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private String toJsonObjectMap(Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map != null ? map : Map.of());
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private Map<String, String> fromJsonStringMap(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    private Map<String, Object> fromJsonObjectMap(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }
}
