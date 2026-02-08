package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * GPT-generated meeting summary (reserved for future PRs).
 */
public record Summary(UUID id, UUID meetingId, String textMd, OffsetDateTime createdAt) {
}
