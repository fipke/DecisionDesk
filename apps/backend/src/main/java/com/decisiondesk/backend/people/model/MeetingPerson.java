package com.decisiondesk.backend.people.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Represents the relationship between a meeting and a person.
 */
public record MeetingPerson(
    UUID meetingId,
    UUID personId,
    PersonRole role,
    OffsetDateTime createdAt
) {
    
    /**
     * Creates a new meeting-person relationship.
     */
    public static MeetingPerson create(UUID meetingId, UUID personId, PersonRole role) {
        return new MeetingPerson(
            meetingId,
            personId,
            role,
            OffsetDateTime.now()
        );
    }
}
