package com.decisiondesk.backend.ai;

import java.math.BigDecimal;

/**
 * Abstraction over AI completion providers (OpenAI, Ollama).
 */
public interface AiCompletionProvider {

    AiCompletion chatCompletion(String systemPrompt, String userPrompt,
                                 String model, int maxTokens, BigDecimal temperature);

    boolean isAvailable();

    String name();
}
