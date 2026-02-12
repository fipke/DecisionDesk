package com.decisiondesk.backend.meetingtypes.model;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Represents a type/category of meeting with associated defaults.
 * Examples: "Daily Standup", "Sprint Review", "Client Call", "1:1"
 */
public record MeetingType(
    UUID id,
    String name,
    String description,
    Map<String, String> requiredTags,
    String defaultWhisperModel,
    UUID summaryTemplateId,
    OffsetDateTime createdAt
) {
    
    /**
     * Creates a new meeting type with minimal required fields.
     */
    public static MeetingType create(String name, String description) {
        return new MeetingType(
            UUID.randomUUID(),
            name,
            description,
            Map.of(),
            null,
            null,
            OffsetDateTime.now()
        );
    }
    
    /**
     * Returns a new meeting type with updated name.
     */
    public MeetingType withName(String newName) {
        return new MeetingType(id, newName, description, requiredTags, defaultWhisperModel, summaryTemplateId, createdAt);
    }
    
    public MeetingType withDescription(String newDescription) {
        return new MeetingType(id, name, newDescription, requiredTags, defaultWhisperModel, summaryTemplateId, createdAt);
    }
    
    public MeetingType withRequiredTags(Map<String, String> tags) {
        return new MeetingType(id, name, description, tags, defaultWhisperModel, summaryTemplateId, createdAt);
    }
    
    public MeetingType withDefaultWhisperModel(String model) {
        return new MeetingType(id, name, description, requiredTags, model, summaryTemplateId, createdAt);
    }
}
