package com.decisiondesk.backend.api.v1.meetingtypes;

import java.util.Map;

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
    String defaultWhisperModel
) {
    public String nameOrDefault() {
        return name != null ? name : "Novo Tipo";
    }
}
