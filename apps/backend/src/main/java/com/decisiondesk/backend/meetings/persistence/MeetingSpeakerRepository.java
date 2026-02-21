package com.decisiondesk.backend.meetings.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.meetings.model.MeetingSpeaker;

/**
 * Repository for meeting speaker CRUD operations.
 */
@Repository
public class MeetingSpeakerRepository {

    private final JdbcClient jdbcClient;

    public MeetingSpeakerRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public MeetingSpeaker create(MeetingSpeaker speaker) {
        jdbcClient.sql("""
                INSERT INTO meeting_speakers (id, meeting_id, label, display_name, person_id, color_index, talk_time_sec)
                VALUES (:id, :meetingId, :label, :displayName, :personId, :colorIndex, :talkTimeSec)
                ON CONFLICT (meeting_id, label) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    person_id = EXCLUDED.person_id,
                    color_index = EXCLUDED.color_index,
                    talk_time_sec = EXCLUDED.talk_time_sec
                """)
                .param("id", speaker.id())
                .param("meetingId", speaker.meetingId())
                .param("label", speaker.label())
                .param("displayName", speaker.displayName())
                .param("personId", speaker.personId())
                .param("colorIndex", speaker.colorIndex())
                .param("talkTimeSec", speaker.talkTimeSec())
                .update();
        return findById(speaker.id()).orElseThrow();
    }

    public Optional<MeetingSpeaker> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, meeting_id, label, display_name, person_id, color_index, talk_time_sec, created_at, updated_at
                FROM meeting_speakers WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapRow)
                .optional();
    }

    public List<MeetingSpeaker> findByMeetingId(UUID meetingId) {
        return jdbcClient.sql("""
                SELECT id, meeting_id, label, display_name, person_id, color_index, talk_time_sec, created_at, updated_at
                FROM meeting_speakers WHERE meeting_id = :meetingId
                ORDER BY color_index
                """)
                .param("meetingId", meetingId)
                .query(this::mapRow)
                .list();
    }

    public MeetingSpeaker update(MeetingSpeaker speaker) {
        jdbcClient.sql("""
                UPDATE meeting_speakers
                SET display_name = :displayName, person_id = :personId,
                    color_index = :colorIndex, talk_time_sec = :talkTimeSec
                WHERE id = :id
                """)
                .param("id", speaker.id())
                .param("displayName", speaker.displayName())
                .param("personId", speaker.personId())
                .param("colorIndex", speaker.colorIndex())
                .param("talkTimeSec", speaker.talkTimeSec())
                .update();
        return findById(speaker.id()).orElseThrow();
    }

    public boolean delete(UUID id) {
        int rows = jdbcClient.sql("DELETE FROM meeting_speakers WHERE id = :id")
                .param("id", id)
                .update();
        return rows > 0;
    }

    public void deleteByMeetingId(UUID meetingId) {
        jdbcClient.sql("DELETE FROM meeting_speakers WHERE meeting_id = :meetingId")
                .param("meetingId", meetingId)
                .update();
    }

    /**
     * Merges absorbId into keepId: reassigns all segments, deletes absorbed speaker, recalculates talk time.
     */
    public void merge(UUID meetingId, UUID keepId, UUID absorbId) {
        // Reassign segments from absorbed speaker to kept speaker
        jdbcClient.sql("""
                UPDATE transcript_segments
                SET speaker_id = :keepId,
                    speaker_label = (SELECT label FROM meeting_speakers WHERE id = :keepId)
                WHERE meeting_id = :meetingId AND speaker_id = :absorbId
                """)
                .param("keepId", keepId)
                .param("absorbId", absorbId)
                .param("meetingId", meetingId)
                .update();

        // Recalculate talk time for kept speaker
        jdbcClient.sql("""
                UPDATE meeting_speakers
                SET talk_time_sec = COALESCE(
                    (SELECT SUM(end_sec - start_sec) FROM transcript_segments WHERE speaker_id = :keepId), 0)
                WHERE id = :keepId
                """)
                .param("keepId", keepId)
                .update();

        // Delete absorbed speaker
        jdbcClient.sql("DELETE FROM meeting_speakers WHERE id = :absorbId")
                .param("absorbId", absorbId)
                .update();
    }

    private MeetingSpeaker mapRow(ResultSet rs, int rowNum) throws SQLException {
        UUID personId = rs.getObject("person_id", UUID.class);
        return new MeetingSpeaker(
            rs.getObject("id", UUID.class),
            rs.getObject("meeting_id", UUID.class),
            rs.getString("label"),
            rs.getString("display_name"),
            personId,
            rs.getInt("color_index"),
            rs.getDouble("talk_time_sec"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}
