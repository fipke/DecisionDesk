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
    private static final String SELECT_FIELDS = """
            SELECT id, created_at, status, folder_id, meeting_type_id, tags, title, updated_at,
                   agenda, live_notes, post_notes, previous_meeting_id, series_id, sequence_num, imported_transcript_source
            """;

    public Optional<Meeting> findById(UUID id) {
        return jdbcClient.sql(SELECT_FIELDS + " FROM meetings WHERE id = :id")
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
        return jdbcClient.sql(SELECT_FIELDS + " FROM meetings WHERE folder_id = :folderId ORDER BY created_at DESC")
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
        return jdbcClient.sql(SELECT_FIELDS + " FROM meetings WHERE meeting_type_id = :meetingTypeId ORDER BY created_at DESC")
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

    /**
     * Finds meetings by series.
     */
    public List<Meeting> findBySeriesId(UUID seriesId) {
        return jdbcClient.sql(SELECT_FIELDS + " FROM meetings WHERE series_id = :seriesId ORDER BY sequence_num, created_at")
                .param("seriesId", seriesId)
                .query(this::mapMeeting)
                .list();
    }

    /**
     * Updates agenda for a meeting.
     */
    public int updateAgenda(UUID id, String agenda) {
        return jdbcClient.sql("UPDATE meetings SET agenda = :agenda, updated_at = NOW() WHERE id = :id")
                .param("agenda", agenda)
                .param("id", id)
                .update();
    }

    /**
     * Updates live notes for a meeting.
     */
    public int updateLiveNotes(UUID id, String liveNotes) {
        return jdbcClient.sql("UPDATE meetings SET live_notes = :liveNotes, updated_at = NOW() WHERE id = :id")
                .param("liveNotes", liveNotes)
                .param("id", id)
                .update();
    }

    /**
     * Updates post notes for a meeting.
     */
    public int updatePostNotes(UUID id, String postNotes) {
        return jdbcClient.sql("UPDATE meetings SET post_notes = :postNotes, updated_at = NOW() WHERE id = :id")
                .param("postNotes", postNotes)
                .param("id", id)
                .update();
    }

    /**
     * Links meeting to a previous meeting for continuity.
     */
    public int updatePreviousMeeting(UUID id, UUID previousMeetingId) {
        return jdbcClient.sql("UPDATE meetings SET previous_meeting_id = :previousMeetingId, updated_at = NOW() WHERE id = :id")
                .param("previousMeetingId", previousMeetingId)
                .param("id", id)
                .update();
    }

    /**
     * Assigns meeting to a series.
     */
    public int updateSeries(UUID id, UUID seriesId, Integer sequenceNum) {
        return jdbcClient.sql("UPDATE meetings SET series_id = :seriesId, sequence_num = :sequenceNum, updated_at = NOW() WHERE id = :id")
                .param("seriesId", seriesId)
                .param("sequenceNum", sequenceNum)
                .param("id", id)
                .update();
    }

    /**
     * Sets the imported transcript source.
     */
    public int updateImportedSource(UUID id, String source) {
        return jdbcClient.sql("UPDATE meetings SET imported_transcript_source = :source, updated_at = NOW() WHERE id = :id")
                .param("source", source)
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
        // V5 notes fields
        String agenda = rs.getString("agenda");
        String liveNotes = rs.getString("live_notes");
        String postNotes = rs.getString("post_notes");
        UUID previousMeetingId = rs.getObject("previous_meeting_id", UUID.class);
        UUID seriesId = rs.getObject("series_id", UUID.class);
        Integer sequenceNum = (Integer) rs.getObject("sequence_num");
        String importedSource = rs.getString("imported_transcript_source");
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, tags, title, updatedAt,
                agenda, liveNotes, postNotes, previousMeetingId, seriesId, sequenceNum, importedSource);
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
