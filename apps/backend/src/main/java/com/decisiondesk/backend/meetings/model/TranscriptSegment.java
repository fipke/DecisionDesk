package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A single timestamped segment of a meeting transcript, optionally tagged with a speaker.
 */
public record TranscriptSegment(
    UUID id,
    UUID meetingId,
    int ordinal,
    double startSec,
    double endSec,
    String text,
    String speakerLabel,
    UUID speakerId,
    OffsetDateTime createdAt
) {

    public static TranscriptSegment create(UUID meetingId, int ordinal, double startSec, double endSec, String text) {
        return new TranscriptSegment(
            UUID.randomUUID(),
            meetingId,
            ordinal,
            startSec,
            endSec,
            text,
            null,
            null,
            OffsetDateTime.now()
        );
    }

    public TranscriptSegment withSpeaker(String speakerLabel, UUID speakerId) {
        return new TranscriptSegment(id, meetingId, ordinal, startSec, endSec, text, speakerLabel, speakerId, createdAt);
    }
}
