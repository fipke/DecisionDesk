package com.decisiondesk.backend.config;

import com.decisiondesk.backend.cost.WhisperCostCalculator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers cost calculation utilities.
 */
@Configuration
public class CostConfiguration {

    /**
     * Exposes a singleton {@link WhisperCostCalculator} for pricing audio uploads.
     *
     * @return calculator bean
     */
    @Bean
    public WhisperCostCalculator whisperCostCalculator() {
        return new WhisperCostCalculator();
    }
}
