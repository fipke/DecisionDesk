package com.decisiondesk.backend.api.v1.ollama;

import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.ai.OllamaClient;
import com.fasterxml.jackson.databind.JsonNode;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * REST controller for managing the local Ollama instance.
 */
@RestController
@RequestMapping(path = "/api/v1/ollama", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Ollama", description = "Local Ollama AI management")
public class OllamaController {

    private final OllamaClient ollamaClient;

    public OllamaController(OllamaClient ollamaClient) {
        this.ollamaClient = ollamaClient;
    }

    @GetMapping("/status")
    @Operation(summary = "Check Ollama status", description = "Returns whether Ollama is running and lists loaded models")
    public StatusResponse getStatus() {
        boolean running = ollamaClient.isAvailable();
        List<ModelInfo> models = List.of();
        if (running) {
            JsonNode tags = ollamaClient.listModels();
            JsonNode modelsNode = tags.path("models");
            if (modelsNode.isArray()) {
                models = new java.util.ArrayList<>();
                for (JsonNode m : modelsNode) {
                    models.add(new ModelInfo(
                            m.path("name").asText(),
                            m.path("size").asLong(0),
                            m.path("details").path("parameter_size").asText("")
                    ));
                }
            }
        }
        return new StatusResponse(running, models);
    }

    @GetMapping("/models")
    @Operation(summary = "List installed Ollama models")
    public JsonNode listModels() {
        return ollamaClient.listModels();
    }

    @PostMapping("/load")
    @Operation(summary = "Load a model into Ollama memory")
    public Map<String, String> loadModel(@RequestBody ModelRequest request) {
        ollamaClient.loadModel(request.model());
        return Map.of("status", "loaded", "model", request.model());
    }

    @PostMapping("/unload")
    @Operation(summary = "Unload a model from Ollama memory")
    public Map<String, String> unloadModel(@RequestBody ModelRequest request) {
        ollamaClient.unloadModel(request.model());
        return Map.of("status", "unloaded", "model", request.model());
    }

    public record StatusResponse(boolean running, List<ModelInfo> models) {}
    public record ModelInfo(String name, long sizeBytes, String parameterSize) {}
    public record ModelRequest(String model) {}
}
