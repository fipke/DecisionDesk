package com.decisiondesk.backend.meetings.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.model.Meeting;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Repository responsible for CRUD interactions with the {@code meetings} table.
 * PR07: Extended to support folders, types, and tags.
 */
@Repository
public class MeetingRepository {

    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    public MeetingRepository(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Creates a new meeting row with {@link MeetingStatus#NEW}.
     *
     * @return the persisted meeting aggregate
     */
    public Meeting create() {
        UUID id = UUID.randomUUID();
        jdbcClient.sql("INSERT INTO meetings (id, status) VALUES (:id, :status)")
                .param("id", id)
                .param("status", MeetingStatus.NEW.name())
                .update();
        return findById(id).orElseThrow();
    }

    /**
     * Finds a meeting by identifier.
     *
     * @param id target meeting
     * @return optional meeting row
     */
    public Optional<Meeting> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, created_at, status, folder_id, meeting_type_id, tags, title, updated_at 
                FROM meetings WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapMeeting)
                .optional();
    }

    /**
     * Finds meetings by folder.
     *
     * @param folderId folder identifier
     * @return list of meetings in the folder
     */
    public List<Meeting> findByFolderId(UUID folderId) {
        return jdbcClient.sql("""
                SELECT id, created_at, status, folder_id, meeting_type_id, tags, title, updated_at 
                FROM meetings WHERE folder_id = :folderId ORDER BY created_at DESC
                """)
                .param("folderId", folderId)
                .query(this::mapMeeting)
                .list();
    }

    /**
     * Finds meetings by meeting type.
     *
     * @param meetingTypeId meeting type identifier
     * @return list of meetings of the type
     */
    public List<Meeting> findByMeetingTypeId(UUID meetingTypeId) {
        return jdbcClient.sql("""
                SELECT id, created_at, status, folder_id, meeting_type_id, tags, title, updated_at 
                FROM meetings WHERE meeting_type_id = :meetingTypeId ORDER BY created_at DESC
                """)
                .param("meetingTypeId", meetingTypeId)
                .query(this::mapMeeting)
                .list();
    }

    /**
     * Updates the status column for the meeting.
     *
     * @param id meeting identifier
     * @param status new status value
     * @return number of rows updated
     */
    public int updateStatus(UUID id, MeetingStatus status) {
        return jdbcClient.sql("UPDATE meetings SET status = :status, updated_at = NOW() WHERE id = :id")
                .param("status", status.name())
                .param("id", id)
                .update();
    }

    /**
     * Updates the folder for a meeting.
     *
     * @param id meeting identifier
     * @param folderId folder identifier
     * @return number of rows updated
     */
    public int updateFolder(UUID id, UUID folderId) {
        return jdbcClient.sql("UPDATE meetings SET folder_id = :folderId, updated_at = NOW() WHERE id = :id")
                .param("folderId", folderId)
                .param("id", id)
                .update();
    }

    /**
     * Updates the meeting type for a meeting.
     *
     * @param id meeting identifier
     * @param meetingTypeId meeting type identifier
     * @return number of rows updated
     */
    public int updateMeetingType(UUID id, UUID meetingTypeId) {
        return jdbcClient.sql("UPDATE meetings SET meeting_type_id = :meetingTypeId, updated_at = NOW() WHERE id = :id")
                .param("meetingTypeId", meetingTypeId)
                .param("id", id)
                .update();
    }

    /**
     * Updates tags for a meeting.
     *
     * @param id meeting identifier
     * @param tags tag map
     * @return number of rows updated
     */
    public int updateTags(UUID id, Map<String, String> tags) {
        return jdbcClient.sql("UPDATE meetings SET tags = :tags::jsonb, updated_at = NOW() WHERE id = :id")
                .param("tags", toJson(tags))
                .param("id", id)
                .update();
    }

    /**
     * Updates the title for a meeting.
     *
     * @param id meeting identifier
     * @param title new title
     * @return number of rows updated
     */
    public int updateTitle(UUID id, String title) {
        return jdbcClient.sql("UPDATE meetings SET title = :title, updated_at = NOW() WHERE id = :id")
                .param("title", title)
                .param("id", id)
                .update();
    }

    private Meeting mapMeeting(ResultSet rs, int rowNum) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);
        MeetingStatus status = MeetingStatus.valueOf(rs.getString("status"));
        UUID folderId = rs.getObject("folder_id", UUID.class);
        UUID meetingTypeId = rs.getObject("meeting_type_id", UUID.class);
        Map<String, String> tags = fromJson(rs.getString("tags"));
        String title = rs.getString("title");
        OffsetDateTime updatedAt = rs.getObject("updated_at", OffsetDateTime.class);
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, tags, title, updatedAt);
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
