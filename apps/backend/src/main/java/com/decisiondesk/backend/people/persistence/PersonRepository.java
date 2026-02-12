package com.decisiondesk.backend.people.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.people.model.Person;

/**
 * Repository for CRUD operations on the people table.
 */
@Repository
public class PersonRepository {

    private final JdbcClient jdbcClient;

    public PersonRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * Creates a new person.
     */
    public Person create(Person person) {
        jdbcClient.sql("""
                INSERT INTO people (id, display_name, full_name, email, notes)
                VALUES (:id, :displayName, :fullName, :email, :notes)
                """)
                .param("id", person.id())
                .param("displayName", person.displayName())
                .param("fullName", person.fullName())
                .param("email", person.email())
                .param("notes", person.notes())
                .update();
        return findById(person.id()).orElseThrow();
    }

    /**
     * Finds a person by id.
     */
    public Optional<Person> findById(UUID id) {
        return jdbcClient.sql("""
                SELECT id, display_name, full_name, email, notes, created_at, updated_at
                FROM people WHERE id = :id
                """)
                .param("id", id)
                .query(this::mapPerson)
                .optional();
    }

    /**
     * Finds all people.
     */
    public List<Person> findAll() {
        return jdbcClient.sql("""
                SELECT id, display_name, full_name, email, notes, created_at, updated_at
                FROM people ORDER BY display_name
                """)
                .query(this::mapPerson)
                .list();
    }

    /**
     * Searches people by display name prefix (case-insensitive).
     * Used for autocomplete functionality.
     * 
     * @param query the search prefix
     * @param limit maximum results to return
     * @return matching people ordered by relevance
     */
    public List<Person> search(String query, int limit) {
        String pattern = query.toLowerCase() + "%";
        return jdbcClient.sql("""
                SELECT id, display_name, full_name, email, notes, created_at, updated_at
                FROM people 
                WHERE LOWER(display_name) LIKE :pattern
                   OR LOWER(full_name) LIKE :pattern
                ORDER BY 
                    CASE WHEN LOWER(display_name) LIKE :pattern THEN 0 ELSE 1 END,
                    display_name
                LIMIT :limit
                """)
                .param("pattern", pattern)
                .param("limit", limit)
                .query(this::mapPerson)
                .list();
    }

    /**
     * Updates an existing person.
     */
    public Person update(Person person) {
        jdbcClient.sql("""
                UPDATE people 
                SET display_name = :displayName, 
                    full_name = :fullName, 
                    email = :email, 
                    notes = :notes,
                    updated_at = NOW()
                WHERE id = :id
                """)
                .param("id", person.id())
                .param("displayName", person.displayName())
                .param("fullName", person.fullName())
                .param("email", person.email())
                .param("notes", person.notes())
                .update();
        return findById(person.id()).orElseThrow();
    }

    /**
     * Deletes a person by id.
     */
    public boolean delete(UUID id) {
        int rows = jdbcClient.sql("DELETE FROM people WHERE id = :id")
                .param("id", id)
                .update();
        return rows > 0;
    }

    /**
     * Checks if a person exists by display name.
     */
    public Optional<Person> findByDisplayName(String displayName) {
        return jdbcClient.sql("""
                SELECT id, display_name, full_name, email, notes, created_at, updated_at
                FROM people WHERE LOWER(display_name) = LOWER(:displayName)
                """)
                .param("displayName", displayName)
                .query(this::mapPerson)
                .optional();
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
}
