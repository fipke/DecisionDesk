package com.decisiondesk.backend.api.v1.meetings;

import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Response payload returned by {@code POST /meetings/{id}/audio}.
 */
public record UploadAudioResponse(UUID meetingId, UUID assetId, MeetingStatus status) {
}
