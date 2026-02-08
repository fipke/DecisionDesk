package com.decisiondesk.backend.meetings.model;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Usage entry capturing costs charged against a meeting.
 */
public record UsageRecord(
        UUID id,
        UUID meetingId,
        Service service,
        BigDecimal units,
        BigDecimal usd,
        BigDecimal brl,
        String meta,
        OffsetDateTime createdAt) {

    /**
     * Usage-producing backend services.
     */
    public enum Service {
        WHISPER,
        GPT
    }
}
