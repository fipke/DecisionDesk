package com.decisiondesk.backend.ai;

import java.math.BigDecimal;

/**
 * Unified response from any AI completion provider (OpenAI, Ollama, etc.).
 */
public record AiCompletion(
    String content,
    String model,
    String provider,
    int promptTokens,
    int completionTokens,
    int totalTokens
) {

    /**
     * Calculates cost in USD. Only OpenAI has a cost; local providers are free.
     */
    public BigDecimal calculateCostUsd() {
        if (!"openai".equals(provider)) {
            return BigDecimal.ZERO;
        }
        BigDecimal inputCost;
        BigDecimal outputCost;
        if (model != null && model.contains("gpt-4o")) {
            inputCost = new BigDecimal(promptTokens).multiply(new BigDecimal("0.0000025"));
            outputCost = new BigDecimal(completionTokens).multiply(new BigDecimal("0.00001"));
        } else if (model != null && model.contains("gpt-4-turbo")) {
            inputCost = new BigDecimal(promptTokens).multiply(new BigDecimal("0.00001"));
            outputCost = new BigDecimal(completionTokens).multiply(new BigDecimal("0.00003"));
        } else {
            inputCost = new BigDecimal(promptTokens).multiply(new BigDecimal("0.0000025"));
            outputCost = new BigDecimal(completionTokens).multiply(new BigDecimal("0.00001"));
        }
        return inputCost.add(outputCost);
    }
}
