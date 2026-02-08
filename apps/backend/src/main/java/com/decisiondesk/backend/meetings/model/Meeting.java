package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Aggregate root representing a meeting captured by the client.
 */
public record Meeting(UUID id, OffsetDateTime createdAt, MeetingStatus status) {
}
