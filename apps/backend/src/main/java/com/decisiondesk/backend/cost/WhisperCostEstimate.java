package com.decisiondesk.backend.cost;

import java.math.BigDecimal;

/**
 * Value object containing Whisper pricing information.
 *
 * @param minutesBilled total whole and fractional minutes priced
 * @param usdCost total Whisper cost in USD
 * @param brlCost total Whisper cost converted to BRL
 */
public record WhisperCostEstimate(BigDecimal minutesBilled, BigDecimal usdCost, BigDecimal brlCost) {
}
