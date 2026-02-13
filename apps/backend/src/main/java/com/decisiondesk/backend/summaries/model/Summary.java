package com.decisiondesk.backend.summaries.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Represents a generated summary for a meeting.
 */
public record Summary(
    UUID id,
    UUID meetingId,
    String textMd,
    UUID templateId,
    String model,
    Integer tokensUsed,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    
    /**
     * Creates a new summary.
     */
    public static Summary create(
        UUID meetingId,
        String textMd,
        UUID templateId,
        String model,
        Integer tokensUsed
    ) {
        return new Summary(
            UUID.randomUUID(),
            meetingId,
            textMd,
            templateId,
            model,
            tokensUsed,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }
}
