package com.decisiondesk.backend.api.v1.meetingtypes;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Request payload for creating or updating a meeting type.
 */
@Schema(description = "Meeting type creation/update request")
public record MeetingTypeRequest(
    @Schema(description = "Meeting type name", example = "Daily Standup")
    String name,

    @Schema(description = "Description of this meeting type", example = "Daily team sync meeting")
    String description,

    @Schema(description = "Tags required for meetings of this type")
    Map<String, String> requiredTags,

    @Schema(description = "Default whisper model for this meeting type", example = "small")
    String defaultWhisperModel,

    @Schema(description = "Summary template IDs to auto-suggest for this meeting type")
    List<UUID> summaryTemplateIds,

    @Schema(description = "AI extraction config (action_items, decisions, deadlines, backlog, etc.)")
    Map<String, Object> extractionConfig,

    @Schema(description = "Preferred AI provider", example = "ollama")
    String aiProvider,

    @Schema(description = "Default participant IDs for this meeting type")
    List<UUID> defaultParticipants,

    @Schema(description = "Icon identifier", example = "bar-chart")
    String icon,

    @Schema(description = "Color hex code", example = "#6366f1")
    String color
) {
    public String nameOrDefault() {
        return name != null ? name : "Novo Tipo";
    }
}
