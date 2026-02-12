package com.decisiondesk.backend.people.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.people.model.MeetingPerson;
import com.decisiondesk.backend.people.model.Person;
import com.decisiondesk.backend.people.model.PersonRole;

/**
 * Repository for meeting-person relationships.
 */
@Repository
public class MeetingPersonRepository {

    private final JdbcClient jdbcClient;

    public MeetingPersonRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * Adds a person to a meeting with a specific role.
     */
    public MeetingPerson addPersonToMeeting(UUID meetingId, UUID personId, PersonRole role) {
        jdbcClient.sql("""
                INSERT INTO meeting_people (meeting_id, person_id, role)
                VALUES (:meetingId, :personId, :role)
                ON CONFLICT (meeting_id, person_id, role) DO NOTHING
                """)
                .param("meetingId", meetingId)
                .param("personId", personId)
                .param("role", role.getValue())
                .update();
        return MeetingPerson.create(meetingId, personId, role);
    }

    /**
     * Removes a person from a meeting with a specific role.
     */
    public boolean removePersonFromMeeting(UUID meetingId, UUID personId, PersonRole role) {
        int rows = jdbcClient.sql("""
                DELETE FROM meeting_people 
                WHERE meeting_id = :meetingId AND person_id = :personId AND role = :role
                """)
                .param("meetingId", meetingId)
                .param("personId", personId)
                .param("role", role.getValue())
                .update();
        return rows > 0;
    }

    /**
     * Finds all people associated with a meeting.
     */
    public List<PersonWithRole> findPeopleByMeeting(UUID meetingId) {
        return jdbcClient.sql("""
                SELECT p.id, p.display_name, p.full_name, p.email, p.notes, 
                       p.created_at, p.updated_at, mp.role
                FROM people p
                JOIN meeting_people mp ON p.id = mp.person_id
                WHERE mp.meeting_id = :meetingId
                ORDER BY mp.role, p.display_name
                """)
                .param("meetingId", meetingId)
                .query(this::mapPersonWithRole)
                .list();
    }

    /**
     * Finds all meetings for a person.
     */
    public List<MeetingPerson> findMeetingsByPerson(UUID personId) {
        return jdbcClient.sql("""
                SELECT meeting_id, person_id, role, created_at
                FROM meeting_people
                WHERE person_id = :personId
                ORDER BY created_at DESC
                """)
                .param("personId", personId)
                .query(this::mapMeetingPerson)
                .list();
    }

    /**
     * Finds participants of a meeting.
     */
    public List<Person> findParticipants(UUID meetingId) {
        return jdbcClient.sql("""
                SELECT p.id, p.display_name, p.full_name, p.email, p.notes, 
                       p.created_at, p.updated_at
                FROM people p
                JOIN meeting_people mp ON p.id = mp.person_id
                WHERE mp.meeting_id = :meetingId AND mp.role = 'participant'
                ORDER BY p.display_name
                """)
                .param("meetingId", meetingId)
                .query(this::mapPerson)
                .list();
    }

    /**
     * Finds mentioned people in a meeting.
     */
    public List<Person> findMentioned(UUID meetingId) {
        return jdbcClient.sql("""
                SELECT p.id, p.display_name, p.full_name, p.email, p.notes, 
                       p.created_at, p.updated_at
                FROM people p
                JOIN meeting_people mp ON p.id = mp.person_id
                WHERE mp.meeting_id = :meetingId AND mp.role = 'mentioned'
                ORDER BY p.display_name
                """)
                .param("meetingId", meetingId)
                .query(this::mapPerson)
                .list();
    }

    private MeetingPerson mapMeetingPerson(ResultSet rs, int rowNum) throws SQLException {
        return new MeetingPerson(
            rs.getObject("meeting_id", UUID.class),
            rs.getObject("person_id", UUID.class),
            PersonRole.fromValue(rs.getString("role")),
            rs.getObject("created_at", OffsetDateTime.class)
        );
    }

    private Person mapPerson(ResultSet rs, int rowNum) throws SQLException {
        return new Person(
            rs.getObject("id", UUID.class),
            rs.getString("display_name"),
            rs.getString("full_name"),
            rs.getString("email"),
            rs.getString("notes"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        );
    }

    private PersonWithRole mapPersonWithRole(ResultSet rs, int rowNum) throws SQLException {
        return new PersonWithRole(
            mapPerson(rs, rowNum),
            PersonRole.fromValue(rs.getString("role"))
        );
    }

    /**
     * Record combining a person with their role in a meeting.
     */
    public record PersonWithRole(Person person, PersonRole role) {}
}
