package com.decisiondesk.backend.api.v1.meetings;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Response payload returned by {@code POST /meetings}.
 */
public record CreateMeetingResponse(UUID id, OffsetDateTime createdAt) {
}
