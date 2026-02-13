package com.decisiondesk.backend.notes.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Notes template by language with default blocks.
 */
public record NotesTemplate(
    UUID id,
    String language,
    String name,
    String template,
    boolean isDefault,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    
    /**
     * Creates a new notes template.
     */
    public static NotesTemplate create(String language, String name, String template) {
        return new NotesTemplate(
            UUID.randomUUID(),
            language,
            name,
            template,
            false,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
    
    public NotesTemplate withTemplate(String newTemplate) {
        return new NotesTemplate(id, language, name, newTemplate, isDefault, createdAt, OffsetDateTime.now());
    }
    
    public NotesTemplate asDefault() {
        return new NotesTemplate(id, language, name, template, true, createdAt, OffsetDateTime.now());
    }
}
