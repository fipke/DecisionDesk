package com.decisiondesk.backend.api.v1;

import com.decisiondesk.backend.config.OpenAiProperties;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;

/**
 * Debug endpoint for testing OpenAI connectivity.
 * NOT for production use - removed in later PRs or secured behind auth.
 */
@RestController
@RequestMapping(path = "/api/v1/debug", produces = MediaType.APPLICATION_JSON_VALUE)
public class DebugController {

    private final WebClient webClient;
    private final OpenAiProperties openAiProperties;

    public DebugController(WebClient webClient, OpenAiProperties openAiProperties) {
        this.webClient = webClient;
        this.openAiProperties = openAiProperties;
    }

    /**
     * Tests OpenAI API connectivity by fetching the models list endpoint.
     * Returns success if the API key is valid and reachable.
     *
     * @return connection test result
     */
    @GetMapping("/openai-test")
    public ResponseEntity<OpenAiTestResponse> testOpenAiConnection() {
        if (openAiProperties.apiKey() == null || openAiProperties.apiKey().isBlank()) {
            return ResponseEntity.ok(new OpenAiTestResponse(
                    false,
                    "OPENAI_API_KEY not configured",
                    null
            ));
        }

        try {
            String result = webClient.get()
                    .uri("https://api.openai.com/v1/models")
                    .header("Authorization", "Bearer " + openAiProperties.apiKey())
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();

            return ResponseEntity.ok(new OpenAiTestResponse(
                    true,
                    "OpenAI API connection successful",
                    "API key valid, models endpoint reachable"
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(new OpenAiTestResponse(
                    false,
                    "OpenAI API connection failed: " + e.getMessage(),
                    e.getClass().getSimpleName()
            ));
        }
    }

    /**
     * Response contract for the OpenAI connection test.
     *
     * @param success whether the connection test succeeded
     * @param message human-readable message
     * @param details optional additional details
     */
    public record OpenAiTestResponse(boolean success, String message, String details) {
    }
}
