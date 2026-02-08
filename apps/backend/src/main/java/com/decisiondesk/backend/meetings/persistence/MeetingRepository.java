package com.decisiondesk.backend.meetings.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.model.Meeting;

/**
 * Repository responsible for CRUD interactions with the {@code meetings} table.
 */
@Repository
public class MeetingRepository {

    private final JdbcClient jdbcClient;

    public MeetingRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
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
        return jdbcClient.sql("SELECT id, created_at, status FROM meetings WHERE id = :id")
                .param("id", id)
                .query(this::mapMeeting)
                .optional();
    }

    /**
     * Updates the status column for the meeting.
     *
     * @param id meeting identifier
     * @param status new status value
     * @return number of rows updated
     */
    public int updateStatus(UUID id, MeetingStatus status) {
        return jdbcClient.sql("UPDATE meetings SET status = :status WHERE id = :id")
                .param("status", status.name())
                .param("id", id)
                .update();
    }

    private Meeting mapMeeting(ResultSet rs, int rowNum) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);
        MeetingStatus status = MeetingStatus.valueOf(rs.getString("status"));
        return new Meeting(id, createdAt, status);
    }
}
