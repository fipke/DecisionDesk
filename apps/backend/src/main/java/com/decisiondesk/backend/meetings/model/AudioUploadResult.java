package com.decisiondesk.backend.meetings.model;

import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Result returned when an audio file is uploaded and processed.
 */
public record AudioUploadResult(UUID meetingId, UUID assetId, MeetingStatus status) {
}
