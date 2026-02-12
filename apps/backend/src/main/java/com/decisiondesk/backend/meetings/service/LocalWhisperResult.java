package com.decisiondesk.backend.meetings.service;

import java.math.BigDecimal;

/**
 * Result of a local whisper.cpp transcription.
 *
 * @param text            the transcribed text
 * @param language        detected or specified language code
 * @param durationMinutes duration of the audio in minutes
 * @param processingTimeMs time taken to process in milliseconds
 * @param segments        optional segments with timestamps (for diarization)
 */
public record LocalWhisperResult(
        String text,
        String language,
        BigDecimal durationMinutes,
        long processingTimeMs,
        String segments
) {
    /**
     * Creates a result without segments.
     */
    public static LocalWhisperResult of(String text, String language, BigDecimal durationMinutes, long processingTimeMs) {
        return new LocalWhisperResult(text, language, durationMinutes, processingTimeMs, null);
    }
}
