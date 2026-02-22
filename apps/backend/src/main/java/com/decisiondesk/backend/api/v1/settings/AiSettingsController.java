package com.decisiondesk.backend.api.v1.settings;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.ai.OllamaClient;
import com.decisiondesk.backend.notes.model.UserPreference;
import com.decisiondesk.backend.notes.persistence.UserPreferenceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * REST controller for AI provider settings (per-task model/provider configuration).
 */
@RestController
@RequestMapping(path = "/api/v1/settings/ai", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "AI Settings", description = "AI provider and model configuration")
public class AiSettingsController {

    private static final String DEFAULT_USER = "default";
    private static final String DEFAULT_AI_CONFIG = """
            {
                "summarization": {"provider": "ollama", "model": "qwen3:14b"},
                "extraction": {"provider": "ollama", "model": "qwen3:14b"},
                "chat": {"provider": "ollama", "model": "qwen3:14b"},
                "openaiEnabled": false
            }""";

    private final UserPreferenceRepository preferenceRepository;
    private final OllamaClient ollamaClient;
    private final ObjectMapper objectMapper;

    public AiSettingsController(UserPreferenceRepository preferenceRepository,
                                 OllamaClient ollamaClient,
                                 ObjectMapper objectMapper) {
        this.preferenceRepository = preferenceRepository;
        this.ollamaClient = ollamaClient;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    @Operation(summary = "Get AI settings", description = "Returns current AI provider and model configuration per task type")
    public AiSettingsResponse getAiSettings() {
        UserPreference pref = preferenceRepository.findByUserId(DEFAULT_USER).orElse(null);
        String aiConfigJson = (pref != null && pref.aiConfig() != null) ? pref.aiConfig() : DEFAULT_AI_CONFIG;

        try {
            Map<String, Object> config = objectMapper.readValue(aiConfigJson,
                    objectMapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
            return new AiSettingsResponse(config, ollamaClient.isAvailable());
        } catch (JsonProcessingException e) {
            Map<String, Object> fallback = Map.of(
                    "summarization", Map.of("provider", "ollama", "model", "qwen3:14b"),
                    "extraction", Map.of("provider", "ollama", "model", "qwen3:14b"),
                    "chat", Map.of("provider", "ollama", "model", "qwen3:14b"),
                    "openaiEnabled", false
            );
            return new AiSettingsResponse(fallback, ollamaClient.isAvailable());
        }
    }

    @PutMapping
    @Operation(summary = "Update AI settings", description = "Updates AI provider and model configuration")
    public AiSettingsResponse updateAiSettings(@RequestBody Map<String, Object> config) {
        try {
            String aiConfigJson = objectMapper.writeValueAsString(config);
            UserPreference pref = preferenceRepository.findByUserId(DEFAULT_USER)
                    .orElse(UserPreference.create(DEFAULT_USER));
            pref = pref.withAiConfig(aiConfigJson);
            preferenceRepository.upsert(pref);
            return new AiSettingsResponse(config, ollamaClient.isAvailable());
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Invalid AI config JSON", e);
        }
    }

    public record AiSettingsResponse(Map<String, Object> config, boolean ollamaAvailable) {}
}
