package com.decisiondesk.backend.notes.model;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Represents a series of related/recurring meetings.
 */
public record MeetingSeries(
    UUID id,
    String name,
    String description,
    String recurrenceRule,
    UUID defaultFolderId,
    UUID defaultTypeId,
    List<String> defaultTags,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    
    /**
     * Creates a new meeting series.
     */
    public static MeetingSeries create(String name) {
        return new MeetingSeries(
            UUID.randomUUID(),
            name,
            null,
            null,
            null,
            null,
            List.of(),
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
    
    /**
     * Creates a new meeting series with description.
     */
    public static MeetingSeries create(String name, String description) {
        return new MeetingSeries(
            UUID.randomUUID(),
            name,
            description,
            null,
            null,
            null,
            List.of(),
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
    
    public MeetingSeries withRecurrenceRule(String rule) {
        return new MeetingSeries(id, name, description, rule, defaultFolderId, defaultTypeId, defaultTags, createdAt, OffsetDateTime.now());
    }
    
    public MeetingSeries withDefaults(UUID folderId, UUID typeId, List<String> tags) {
        return new MeetingSeries(id, name, description, recurrenceRule, folderId, typeId, tags, createdAt, OffsetDateTime.now());
    }
}
