package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * GPT-generated meeting summary.
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
}
