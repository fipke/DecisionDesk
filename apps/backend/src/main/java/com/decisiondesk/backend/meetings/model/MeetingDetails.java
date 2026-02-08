package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Composite view returned for {@code GET /meetings/{id}}.
 */
public record MeetingDetails(
        UUID id,
        MeetingStatus status,
        OffsetDateTime createdAt,
        Transcript transcript,
        Summary summary,
        MeetingCostBreakdown cost) {
}
