package com.decisiondesk.backend.people.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Represents a person who can be a meeting participant or be mentioned in notes.
 */
public record Person(
    UUID id,
    String displayName,  // short name for @mentions
    String fullName,
    String email,
    String notes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    
    /**
     * Creates a new person with minimal required fields.
     */
    public static Person create(String displayName) {
        return new Person(
            UUID.randomUUID(),
            displayName,
            null,
            null,
            null,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
    
    /**
     * Creates a new person with full details.
     */
    public static Person create(String displayName, String fullName, String email, String notes) {
        return new Person(
            UUID.randomUUID(),
            displayName,
            fullName,
            email,
            notes,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
}
