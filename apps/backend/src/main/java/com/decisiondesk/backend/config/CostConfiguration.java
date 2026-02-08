package com.decisiondesk.backend.config;

import com.decisiondesk.backend.cost.CostProperties;
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
     * @param costProperties pricing and FX configuration
     * @return calculator bean
     */
    @Bean
    public WhisperCostCalculator whisperCostCalculator(CostProperties costProperties) {
        return new WhisperCostCalculator(costProperties);
    }
}
