package com.decisiondesk.backend.meetingtypes.model;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Represents a meeting type that acts as a "starter template" — presets that suggest
 * which summaries to generate, what AI should extract, and how to present the meeting data.
 * A meeting type is a facilitator, not a limitation.
 */
public record MeetingType(
    UUID id,
    String name,
    String description,
    Map<String, String> requiredTags,
    String defaultWhisperModel,
    UUID summaryTemplateId,
    List<UUID> summaryTemplateIds,
    Map<String, Object> extractionConfig,
    String aiProvider,
    List<UUID> defaultParticipants,
    String icon,
    String color,
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
            List.of(),
            Map.of("action_items", true, "decisions", true, "deadlines", true),
            "ollama",
            List.of(),
            null,
            null,
            OffsetDateTime.now()
        );
    }

    public MeetingType withName(String newName) {
        return new MeetingType(id, newName, description, requiredTags, defaultWhisperModel, summaryTemplateId, summaryTemplateIds, extractionConfig, aiProvider, defaultParticipants, icon, color, createdAt);
    }

    public MeetingType withDescription(String newDescription) {
        return new MeetingType(id, name, newDescription, requiredTags, defaultWhisperModel, summaryTemplateId, summaryTemplateIds, extractionConfig, aiProvider, defaultParticipants, icon, color, createdAt);
    }

    public MeetingType withRequiredTags(Map<String, String> tags) {
        return new MeetingType(id, name, description, tags, defaultWhisperModel, summaryTemplateId, summaryTemplateIds, extractionConfig, aiProvider, defaultParticipants, icon, color, createdAt);
    }

    public MeetingType withDefaultWhisperModel(String model) {
        return new MeetingType(id, name, description, requiredTags, model, summaryTemplateId, summaryTemplateIds, extractionConfig, aiProvider, defaultParticipants, icon, color, createdAt);
    }
}
