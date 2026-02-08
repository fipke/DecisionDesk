package com.decisiondesk.backend.api.v1.meetings;

import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Response payload returned by {@code POST /meetings/{id}/transcribe}.
 */
public record TranscribeResponse(UUID meetingId, MeetingStatus status) {
}
