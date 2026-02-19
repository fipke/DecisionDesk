package com.decisiondesk.backend.api.v1.meetingtypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Response payload for meeting type operations.
 */
@Schema(description = "Meeting type details")
public record MeetingTypeResponse(
    @Schema(description = "Meeting type unique identifier")
    UUID id,

    @Schema(description = "Meeting type name", example = "Daily Standup")
    String name,

    @Schema(description = "Description", example = "Daily team sync meeting")
    String description,

    @Schema(description = "Required tags for this meeting type")
    Map<String, String> requiredTags,

    @Schema(description = "Default whisper model")
    String defaultWhisperModel,

    @Schema(description = "Summary template IDs suggested for this type")
    List<UUID> summaryTemplateIds,

    @Schema(description = "AI extraction configuration")
    Map<String, Object> extractionConfig,

    @Schema(description = "Preferred AI provider")
    String aiProvider,

    @Schema(description = "Default participant IDs")
    List<UUID> defaultParticipants,

    @Schema(description = "Icon identifier")
    String icon,

    @Schema(description = "Color hex code")
    String color,

    @Schema(description = "Creation timestamp")
    OffsetDateTime createdAt
) {}
