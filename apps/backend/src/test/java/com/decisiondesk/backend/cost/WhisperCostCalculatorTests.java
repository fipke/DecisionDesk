package com.decisiondesk.backend.cost;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.Test;

class WhisperCostCalculatorTests {

    private final WhisperCostCalculator calculator = new WhisperCostCalculator();

    @Test
    void estimateRoundsToMicroDollars() {
        WhisperCostEstimate estimate = calculator.estimate(Duration.ofSeconds(90));

        assertThat(estimate.minutesBilled()).isEqualByComparingTo("1.500000");
        assertThat(estimate.usdCost()).isEqualByComparingTo("0.009000");
    }
}
