package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Persisted audio asset metadata linked to a meeting.
 */
public record AudioAsset(
        UUID id,
        UUID meetingId,
        String path,
        String codec,
        Integer sampleRate,
        Long sizeBytes,
        Integer durationSec,
        OffsetDateTime createdAt) {
}
