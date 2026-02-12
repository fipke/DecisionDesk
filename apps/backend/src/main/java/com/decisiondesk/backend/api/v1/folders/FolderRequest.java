package com.decisiondesk.backend.api.v1.folders;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Request payload for creating or updating a folder.
 */
@Schema(description = "Folder creation/update request")
public record FolderRequest(
    @Schema(description = "Folder name", example = "Projetos 2024")
    String name,
    
    @Schema(description = "Parent folder ID (null for root level)", example = "00000000-0000-0000-0000-000000000001")
    UUID parentId,
    
    @Schema(description = "Default tags to apply to meetings in this folder")
    java.util.Map<String, String> defaultTags,
    
    @Schema(description = "Default whisper model for meetings in this folder", example = "medium")
    String defaultWhisperModel
) {
    public String nameOrDefault() {
        return name != null ? name : "Nova Pasta";
    }
}
