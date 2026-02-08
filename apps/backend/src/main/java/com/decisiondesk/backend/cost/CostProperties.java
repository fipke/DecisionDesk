package com.decisiondesk.backend.cost;

import java.math.BigDecimal;
import java.util.Objects;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Maps pricing and FX configuration for the cost estimators.
 *
 * @param whisperPricePerMinUsd OpenAI Whisper price per audio minute in USD
 * @param gptPricePer1kPromptUsd GPT prompt token price per 1k tokens in USD
 * @param gptPricePer1kCompletionUsd GPT completion token price per 1k tokens in USD
 * @param fxUsdBrl USD to BRL conversion factor applied to server-side costs
 */
@ConfigurationProperties(prefix = "costs")
public record CostProperties(
        BigDecimal whisperPricePerMinUsd,
        BigDecimal gptPricePer1kPromptUsd,
        BigDecimal gptPricePer1kCompletionUsd,
        BigDecimal fxUsdBrl) {

    /**
     * Validates mandatory pricing fields.
     */
    public CostProperties {
        Objects.requireNonNull(whisperPricePerMinUsd, "costs.whisper-price-per-min-usd is required");
        Objects.requireNonNull(gptPricePer1kPromptUsd, "costs.gpt-price-per-1k-prompt-usd is required");
        Objects.requireNonNull(gptPricePer1kCompletionUsd, "costs.gpt-price-per-1k-completion-usd is required");
        Objects.requireNonNull(fxUsdBrl, "costs.fx-usd-brl is required");
    }
}
