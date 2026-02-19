package com.decisiondesk.backend.ai;

import java.math.BigDecimal;

import org.springframework.stereotype.Component;

import com.decisiondesk.backend.openai.GptClient;
import com.decisiondesk.backend.openai.GptCompletion;

/**
 * Wraps the existing {@link GptClient} as an {@link AiCompletionProvider}.
 */
@Component
public class OpenAiCompletionProvider implements AiCompletionProvider {

    private final GptClient gptClient;

    public OpenAiCompletionProvider(GptClient gptClient) {
        this.gptClient = gptClient;
    }

    @Override
    public AiCompletion chatCompletion(String systemPrompt, String userPrompt,
                                        String model, int maxTokens, BigDecimal temperature) {
        GptCompletion c = gptClient.chatCompletion(systemPrompt, userPrompt, model, maxTokens, temperature);
        return new AiCompletion(c.content(), c.model(), "openai",
                c.promptTokens(), c.completionTokens(), c.totalTokens());
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public String name() {
        return "openai";
    }
}
