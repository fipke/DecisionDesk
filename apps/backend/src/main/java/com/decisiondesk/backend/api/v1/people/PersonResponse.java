package com.decisiondesk.backend.api.v1.people;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.decisiondesk.backend.people.model.Person;

/**
 * Response body for person data.
 */
public record PersonResponse(
    UUID id,
    String displayName,
    String fullName,
    String email,
    String notes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    
    public static PersonResponse from(Person person) {
        return new PersonResponse(
            person.id(),
            person.displayName(),
            person.fullName(),
            person.email(),
            person.notes(),
            person.createdAt(),
            person.updatedAt()
        );
    }
}
