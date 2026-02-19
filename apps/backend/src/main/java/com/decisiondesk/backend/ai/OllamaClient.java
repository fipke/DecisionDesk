package com.decisiondesk.backend.ai;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * REST client for local Ollama API.
 * Mirrors the pattern from {@link com.decisiondesk.backend.openai.GptClient}.
 */
@Component
public class OllamaClient implements AiCompletionProvider {

    private static final Logger log = LoggerFactory.getLogger(OllamaClient.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public OllamaClient(
            @Value("${ollama.base-url:http://localhost:11434}") String baseUrl,
            WebClient.Builder builder,
            ObjectMapper objectMapper) {
        this.webClient = builder
                .baseUrl(baseUrl)
                .defaultHeader("Content-Type", "application/json")
                .build();
        this.objectMapper = objectMapper;
    }

    @Override
    public AiCompletion chatCompletion(String systemPrompt, String userPrompt,
                                        String model, int maxTokens, BigDecimal temperature) {
        log.info("Sending Ollama chat request: model={}", model);

        Map<String, Object> request = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userPrompt)
                ),
                "stream", false,
                "options", Map.of(
                        "num_predict", maxTokens,
                        "temperature", temperature.doubleValue()
                )
        );

        try {
            String requestBody = objectMapper.writeValueAsString(request);

            String response = webClient.post()
                    .uri("/api/chat")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMinutes(5))
                    .block();

            if (response == null || response.isBlank()) {
                throw new OllamaException("Empty response from Ollama API");
            }

            JsonNode root = objectMapper.readTree(response);
            String content = root.path("message").path("content").asText();
            String usedModel = root.path("model").asText(model);

            int promptTokens = root.path("prompt_eval_count").asInt(0);
            int completionTokens = root.path("eval_count").asInt(0);
            int totalTokens = promptTokens + completionTokens;

            log.info("Ollama completion done: model={}, tokens={}", usedModel, totalTokens);

            return new AiCompletion(content, usedModel, "ollama",
                    promptTokens, completionTokens, totalTokens);

        } catch (OllamaException e) {
            throw e;
        } catch (Exception e) {
            log.error("Ollama request failed: {}", e.getMessage(), e);
            throw new OllamaException("Ollama request failed: " + e.getMessage(), e);
        }
    }

    @Override
    public boolean isAvailable() {
        try {
            String response = webClient.get()
                    .uri("/api/tags")
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(3))
                    .block();
            return response != null;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public String name() {
        return "ollama";
    }

    /**
     * Lists models installed in Ollama.
     */
    public JsonNode listModels() {
        try {
            String response = webClient.get()
                    .uri("/api/tags")
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(5))
                    .block();
            return objectMapper.readTree(response);
        } catch (Exception e) {
            log.warn("Failed to list Ollama models: {}", e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    /**
     * Loads a model into memory (keep_alive: -1 = forever).
     */
    public void loadModel(String model) {
        try {
            webClient.post()
                    .uri("/api/generate")
                    .bodyValue(Map.of("model", model, "keep_alive", "-1"))
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofMinutes(2))
                    .block();
            log.info("Ollama model loaded: {}", model);
        } catch (Exception e) {
            log.error("Failed to load Ollama model {}: {}", model, e.getMessage());
            throw new OllamaException("Failed to load model: " + model, e);
        }
    }

    /**
     * Unloads a model from memory.
     */
    public void unloadModel(String model) {
        try {
            webClient.post()
                    .uri("/api/generate")
                    .bodyValue(Map.of("model", model, "keep_alive", "0"))
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();
            log.info("Ollama model unloaded: {}", model);
        } catch (Exception e) {
            log.warn("Failed to unload Ollama model {}: {}", model, e.getMessage());
        }
    }

    public static class OllamaException extends RuntimeException {
        public OllamaException(String msg) { super(msg); }
        public OllamaException(String msg, Throwable cause) { super(msg, cause); }
    }
}
