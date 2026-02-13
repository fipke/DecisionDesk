package com.decisiondesk.backend.notes.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * User preferences including default language for notes templates.
 */
public record UserPreference(
    UUID id,
    String userId,
    String defaultLanguage,
    String notesTemplate,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    
    public static final String DEFAULT_LANGUAGE = "en";
    
    /**
     * Creates a new user preference with default language.
     */
    public static UserPreference create(String userId) {
        return new UserPreference(
            UUID.randomUUID(),
            userId,
            DEFAULT_LANGUAGE,
            null,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
    
    /**
     * Creates a new user preference with specified language.
     */
    public static UserPreference create(String userId, String language) {
        return new UserPreference(
            UUID.randomUUID(),
            userId,
            language,
            null,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
    
    public UserPreference withLanguage(String newLanguage) {
        return new UserPreference(id, userId, newLanguage, notesTemplate, createdAt, OffsetDateTime.now());
    }
    
    public UserPreference withNotesTemplate(String newTemplate) {
        return new UserPreference(id, userId, defaultLanguage, newTemplate, createdAt, OffsetDateTime.now());
    }
}
