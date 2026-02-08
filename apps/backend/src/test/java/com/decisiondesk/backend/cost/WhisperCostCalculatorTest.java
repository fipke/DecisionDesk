package com.decisiondesk.backend.cost;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Duration;

import org.junit.jupiter.api.Test;

class WhisperCostCalculatorTest {

    private final CostProperties properties = new CostProperties(
            new BigDecimal("0.006"),
            new BigDecimal("0.005"),
            new BigDecimal("0.015"),
            new BigDecimal("5.0"));
    private final WhisperCostCalculator calculator = new WhisperCostCalculator(properties);

    @Test
    void estimateRoundsUpToWholeMinutes() {
        WhisperCostEstimate estimate = calculator.estimate(Duration.ofSeconds(90));

        assertThat(estimate.minutesBilled()).isEqualByComparingTo("2");
        assertThat(estimate.usdCost()).isEqualByComparingTo("0.012000");
        assertThat(estimate.brlCost()).isEqualByComparingTo("0.060000");
    }

    @Test
    void estimateSupportsZeroDuration() {
        WhisperCostEstimate estimate = calculator.estimate(Duration.ZERO);

        assertThat(estimate.minutesBilled()).isZero();
        assertThat(estimate.usdCost()).isZero();
        assertThat(estimate.brlCost()).isZero();
    }

    @Test
    void estimateRejectsNegativeDurations() {
        assertThatThrownBy(() -> calculator.estimate(Duration.ofSeconds(-1)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("duration must be positive");
    }

    @Test
    void estimateFromMinutesHonoursCeiling() {
        WhisperCostEstimate estimate = calculator.estimateFromMinutes(new BigDecimal("1.2"));

        assertThat(estimate.minutesBilled()).isEqualByComparingTo("2");
        assertThat(estimate.usdCost()).isEqualByComparingTo("0.012000");
    }
}
