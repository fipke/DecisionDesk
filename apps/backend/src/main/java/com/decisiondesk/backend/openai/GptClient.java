package com.decisiondesk.backend.openai;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import com.decisiondesk.backend.config.OpenAiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Client for OpenAI GPT chat completions API.
 */
@Component
public class GptClient {

    private static final Logger log = LoggerFactory.getLogger(GptClient.class);
    private static final String CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public GptClient(OpenAiProperties properties, WebClient.Builder builder, ObjectMapper objectMapper) {
        this.webClient = builder
                .baseUrl("https://api.openai.com/v1")
                .defaultHeader("Authorization", "Bearer " + properties.apiKey())
                .defaultHeader("Content-Type", "application/json")
                .build();
        this.objectMapper = objectMapper;
    }

    /**
     * Sends a chat completion request to GPT.
     *
     * @param systemPrompt the system role content
     * @param userPrompt the user message
     * @param model the model to use (e.g., "gpt-4o")
     * @param maxTokens max output tokens
     * @param temperature temperature (0.0-2.0)
     * @return the completion result
     */
    public GptCompletion chatCompletion(
        String systemPrompt,
        String userPrompt,
        String model,
        int maxTokens,
        BigDecimal temperature
    ) {
        log.info("Sending chat completion request to model={}, maxTokens={}", model, maxTokens);
        
        Map<String, Object> request = Map.of(
            "model", model,
            "messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
            ),
            "max_tokens", maxTokens,
            "temperature", temperature.doubleValue()
        );

        try {
            String requestBody = objectMapper.writeValueAsString(request);
            
            String response = webClient.post()
                    .uri("/chat/completions")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            if (response == null || response.isBlank()) {
                throw new GptClientException("Empty response from GPT API");
            }

            JsonNode root = objectMapper.readTree(response);
            
            // Extract content
            String content = root.path("choices").path(0).path("message").path("content").asText();
            String usedModel = root.path("model").asText();
            
            // Extract usage
            JsonNode usage = root.path("usage");
            int promptTokens = usage.path("prompt_tokens").asInt();
            int completionTokens = usage.path("completion_tokens").asInt();
            int totalTokens = usage.path("total_tokens").asInt();

            log.info("GPT completion successful: model={}, tokens={}", usedModel, totalTokens);

            return new GptCompletion(content, usedModel, promptTokens, completionTokens, totalTokens);

        } catch (GptClientException e) {
            throw e;
        } catch (Exception e) {
            log.error("GPT request failed: {}", e.getMessage(), e);
            throw new GptClientException("GPT request failed: " + e.getMessage(), e);
        }
    }
}
