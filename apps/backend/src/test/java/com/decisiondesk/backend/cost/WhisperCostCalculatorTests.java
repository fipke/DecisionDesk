package com.decisiondesk.backend.cost;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Duration;

import org.junit.jupiter.api.Test;

class WhisperCostCalculatorTests {

    private final CostProperties properties = new CostProperties(
            new BigDecimal("0.006"),
            new BigDecimal("0.005"),
            new BigDecimal("0.015"),
            new BigDecimal("5.0"));
    private final WhisperCostCalculator calculator = new WhisperCostCalculator(properties);

    @Test
    void estimateRoundsToMicroDollars() {
        WhisperCostEstimate estimate = calculator.estimate(Duration.ofSeconds(90));

        assertThat(estimate.minutesBilled()).isEqualByComparingTo("2");
        assertThat(estimate.usdCost()).isEqualByComparingTo("0.012000");
    }
}
