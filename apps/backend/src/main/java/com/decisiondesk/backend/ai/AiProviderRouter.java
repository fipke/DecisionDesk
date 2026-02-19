package com.decisiondesk.backend.ai;

import java.util.Map;

import org.springframework.stereotype.Component;

/**
 * Routes AI requests to the correct provider based on name.
 */
@Component
public class AiProviderRouter {

    private final Map<String, AiCompletionProvider> providers;

    public AiProviderRouter(OpenAiCompletionProvider openAi, OllamaClient ollama) {
        this.providers = Map.of(
                "openai", openAi,
                "ollama", ollama
        );
    }

    /**
     * Gets the provider by name, falling back to Ollama if unknown.
     */
    public AiCompletionProvider getProvider(String providerName) {
        if (providerName == null || providerName.isBlank()) {
            return providers.get("ollama");
        }
        return providers.getOrDefault(providerName, providers.get("ollama"));
    }

    public AiCompletionProvider ollama() {
        return providers.get("ollama");
    }

    public AiCompletionProvider openai() {
        return providers.get("openai");
    }

    public boolean isOllamaAvailable() {
        return providers.get("ollama").isAvailable();
    }
}
