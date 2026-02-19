package com.decisiondesk.backend.api.v1.meetings;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Response contract for {@code GET /meetings/{id}}.
 */
public record MeetingDetailsResponse(
        UUID id,
        MeetingStatus status,
        OffsetDateTime createdAt,
        String title,
        Integer durationSec,
        Integer minutes,
        Transcript transcript,
        Summary summary,
        Cost cost) {

    public record Transcript(String language, String text) {
    }

    public record Summary(String textMd) {
    }

    public record Cost(Whisper whisper, Gpt gpt, Total total) {
    }

    public record Whisper(BigDecimal minutes, BigDecimal usd, BigDecimal brl) {
    }

    public record Gpt(Long promptTokens, Long completionTokens, BigDecimal usd, BigDecimal brl) {
    }

    public record Total(BigDecimal usd, BigDecimal brl) {
    }
}
