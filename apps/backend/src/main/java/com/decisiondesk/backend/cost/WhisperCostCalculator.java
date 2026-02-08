package com.decisiondesk.backend.cost;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.Objects;

/**
 * Calculates approximate Whisper transcription costs based on configured pricing.
 */
public class WhisperCostCalculator {

    private static final BigDecimal MILLIS_PER_MINUTE = BigDecimal.valueOf(60_000L);
    private static final int MONETARY_SCALE = 6;

    private final CostProperties costProperties;

    /**
     * Creates a calculator backed by the configured pricing tables.
     *
     * @param costProperties pricing and FX configuration
     */
    public WhisperCostCalculator(CostProperties costProperties) {
        this.costProperties = Objects.requireNonNull(costProperties, "costProperties");
    }

    /**
     * Estimates the Whisper cost for a given audio duration.
     *
     * @param duration audio length to price
     * @return the calculated estimate in minutes, USD, and BRL
     */
    public WhisperCostEstimate estimate(Duration duration) {
        Objects.requireNonNull(duration, "duration");
        if (duration.isNegative()) {
            throw new IllegalArgumentException("duration must be positive");
        }

        BigDecimal minutes = BigDecimal.valueOf(duration.toMillis())
                .divide(MILLIS_PER_MINUTE, 0, RoundingMode.UP);
        return estimateFromMinutes(minutes);
    }

    /**
     * Calculates Whisper costs using a precomputed number of billable minutes.
     * The minutes are rounded up to the nearest whole minute to match the
     * provider's pricing guidance.
     *
     * @param minutes billable minutes (ceil applied by the caller or here)
     * @return estimated USD/BRL totals
     */
    public WhisperCostEstimate estimateFromMinutes(BigDecimal minutes) {
        Objects.requireNonNull(minutes, "minutes");
        if (minutes.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("minutes must be positive");
        }

        BigDecimal billedMinutes = minutes.setScale(0, RoundingMode.UP);
        BigDecimal usdCost = billedMinutes.multiply(costProperties.whisperPricePerMinUsd())
                .setScale(MONETARY_SCALE, RoundingMode.HALF_UP);
        BigDecimal brlCost = usdCost.multiply(costProperties.fxUsdBrl())
                .setScale(MONETARY_SCALE, RoundingMode.HALF_UP);
        return new WhisperCostEstimate(billedMinutes, usdCost, brlCost);
    }
}
