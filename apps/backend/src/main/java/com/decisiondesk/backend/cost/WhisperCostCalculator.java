package com.decisiondesk.backend.cost;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.Objects;

/**
 * Calculates approximate Whisper transcription costs.
 */
public class WhisperCostCalculator {

    /** Price per minute in USD for Whisper large-v3 as of 2024-12. */
    public static final BigDecimal USD_PRICE_PER_MINUTE = new BigDecimal("0.006");

    /**
     * Estimates the Whisper cost for a given audio duration.
     *
     * @param duration audio length to price
     * @return the calculated estimate
     */
    public WhisperCostEstimate estimate(Duration duration) {
        Objects.requireNonNull(duration, "duration");
        if (duration.isNegative()) {
            throw new IllegalArgumentException("duration must be positive");
        }

        BigDecimal minutes = BigDecimal.valueOf(duration.toMillis())
                .divide(BigDecimal.valueOf(60_000), 6, RoundingMode.HALF_UP);
        BigDecimal cost = minutes.multiply(USD_PRICE_PER_MINUTE)
                .setScale(6, RoundingMode.HALF_UP);
        return new WhisperCostEstimate(minutes, cost);
    }
}
