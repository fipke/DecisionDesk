package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Projection for the meeting list endpoint — includes duration and category.
 */
public record MeetingListItem(
    UUID id,
    MeetingStatus status,
    String title,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    Integer durationSec,
    Integer minutes,
    UUID meetingTypeId,
    String meetingTypeName
) {}
