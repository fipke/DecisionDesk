package com.decisiondesk.backend.openai;

import java.math.BigDecimal;

/**
 * Result from GPT chat completion.
 */
public record GptCompletion(
    String content,
    String model,
    int promptTokens,
    int completionTokens,
    int totalTokens
) {
    
    /**
     * Calculates the cost in USD based on OpenAI pricing.
     * GPT-4o: $2.50/1M input tokens, $10.00/1M output tokens
     * GPT-4-turbo: $10.00/1M input, $30.00/1M output
     */
    public BigDecimal calculateCostUsd() {
        BigDecimal inputCost;
        BigDecimal outputCost;
        
        if (model != null && model.contains("gpt-4o")) {
            // GPT-4o pricing
            inputCost = new BigDecimal(promptTokens).multiply(new BigDecimal("0.0000025"));
            outputCost = new BigDecimal(completionTokens).multiply(new BigDecimal("0.00001"));
        } else if (model != null && model.contains("gpt-4-turbo")) {
            // GPT-4-turbo pricing
            inputCost = new BigDecimal(promptTokens).multiply(new BigDecimal("0.00001"));
            outputCost = new BigDecimal(completionTokens).multiply(new BigDecimal("0.00003"));
        } else {
            // Default to GPT-4o pricing
            inputCost = new BigDecimal(promptTokens).multiply(new BigDecimal("0.0000025"));
            outputCost = new BigDecimal(completionTokens).multiply(new BigDecimal("0.00001"));
        }
        
        return inputCost.add(outputCost);
    }
}
