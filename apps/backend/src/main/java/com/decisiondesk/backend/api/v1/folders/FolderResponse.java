package com.decisiondesk.backend.api.v1.folders;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Response payload for folder operations.
 */
@Schema(description = "Folder details")
public record FolderResponse(
    @Schema(description = "Folder unique identifier")
    UUID id,
    
    @Schema(description = "Folder name", example = "Projetos 2024")
    String name,
    
    @Schema(description = "Full hierarchical path", example = "/Raiz/Projetos 2024")
    String path,
    
    @Schema(description = "Parent folder ID")
    UUID parentId,
    
    @Schema(description = "Default tags for meetings")
    Map<String, String> defaultTags,
    
    @Schema(description = "Default whisper model")
    String defaultWhisperModel,
    
    @Schema(description = "Creation timestamp")
    OffsetDateTime createdAt,
    
    @Schema(description = "Last update timestamp")
    OffsetDateTime updatedAt
) {}
