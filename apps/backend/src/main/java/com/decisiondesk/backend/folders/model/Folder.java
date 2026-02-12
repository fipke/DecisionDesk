package com.decisiondesk.backend.folders.model;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Represents a hierarchical folder for organizing meetings.
 * Supports default tags and whisper model settings that cascade to meetings.
 */
public record Folder(
    UUID id,
    String name,
    String path,
    UUID parentId,
    Map<String, String> defaultTags,
    String defaultWhisperModel,
    UUID summaryTemplateId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    
    /**
     * Creates a new folder with minimal required fields.
     */
    public static Folder create(String name, String path, UUID parentId) {
        return new Folder(
            UUID.randomUUID(),
            name,
            path,
            parentId,
            Map.of(),
            null,
            null,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
    
    /**
     * Creates a root folder.
     */
    public static Folder root() {
        return new Folder(
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            "Raiz",
            "/",
            null,
            Map.of(),
            null,
            null,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
    
    /**
     * Returns true if this is the root folder.
     */
    public boolean isRoot() {
        return "/".equals(path) && parentId == null;
    }
    
    /**
     * Returns a new folder with updated fields.
     */
    public Folder withName(String newName) {
        return new Folder(id, newName, path, parentId, defaultTags, defaultWhisperModel, summaryTemplateId, createdAt, OffsetDateTime.now());
    }
    
    public Folder withDefaultTags(Map<String, String> tags) {
        return new Folder(id, name, path, parentId, tags, defaultWhisperModel, summaryTemplateId, createdAt, OffsetDateTime.now());
    }
    
    public Folder withDefaultWhisperModel(String model) {
        return new Folder(id, name, path, parentId, defaultTags, model, summaryTemplateId, createdAt, OffsetDateTime.now());
    }
}
