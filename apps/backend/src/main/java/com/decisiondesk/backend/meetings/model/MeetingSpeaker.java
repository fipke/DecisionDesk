package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Represents a speaker identified in a meeting transcript via diarization.
 * Speakers can be linked to a Person for cross-meeting identity.
 */
public record MeetingSpeaker(
    UUID id,
    UUID meetingId,
    String label,
    String displayName,
    UUID personId,
    int colorIndex,
    double talkTimeSec,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {

    public static MeetingSpeaker create(UUID meetingId, String label, int colorIndex) {
        return new MeetingSpeaker(
            UUID.randomUUID(),
            meetingId,
            label,
            null,
            null,
            colorIndex,
            0,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }

    public MeetingSpeaker withDisplayName(String displayName) {
        return new MeetingSpeaker(id, meetingId, label, displayName, personId, colorIndex, talkTimeSec, createdAt, OffsetDateTime.now());
    }

    public MeetingSpeaker withPersonId(UUID personId) {
        return new MeetingSpeaker(id, meetingId, label, displayName, personId, colorIndex, talkTimeSec, createdAt, OffsetDateTime.now());
    }

    public MeetingSpeaker withTalkTimeSec(double talkTimeSec) {
        return new MeetingSpeaker(id, meetingId, label, displayName, personId, colorIndex, talkTimeSec, createdAt, OffsetDateTime.now());
    }
}
