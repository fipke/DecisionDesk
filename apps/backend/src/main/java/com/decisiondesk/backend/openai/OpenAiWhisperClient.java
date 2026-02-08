package com.decisiondesk.backend.openai;

import java.io.IOException;
import java.nio.file.Path;

import com.decisiondesk.backend.config.OpenAiProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * {@link WhisperClient} implementation backed by OpenAI's REST API.
 */
@Component
public class OpenAiWhisperClient implements WhisperClient {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public OpenAiWhisperClient(OpenAiProperties properties, WebClient.Builder builder, ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.webClient = builder.clone()
                .baseUrl("https://api.openai.com/v1")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey())
                .build();
    }

    @Override
    public WhisperTranscription transcribe(Path audioPath, String originalFilename, String contentType, String language) {
        MultipartBodyBuilder parts = new MultipartBodyBuilder();
        MediaType mediaType;
        try {
            mediaType = contentType != null ? MediaType.parseMediaType(contentType) : MediaType.APPLICATION_OCTET_STREAM;
        } catch (InvalidMediaTypeException ex) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        parts.part("file", new FileSystemResource(audioPath))
                .filename(originalFilename)
                .contentType(mediaType);
        parts.part("model", DEFAULT_MODEL);
        if (language != null && !language.isBlank()) {
            parts.part("language", language);
        }
        parts.part("response_format", "verbose_json");

        try {
            String payload = webClient.post()
                    .uri("/audio/transcriptions")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(parts.build()))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            if (payload == null || payload.isBlank()) {
                throw new WhisperClientException("Empty response from OpenAI Whisper API");
            }

            VerboseJsonResponse response = objectMapper.readValue(payload, VerboseJsonResponse.class);
            return new WhisperTranscription(
                    response.id(),
                    response.text(),
                    response.language(),
                    response.duration(),
                    response.model());
        } catch (WebClientResponseException ex) {
            String errorBody = ex.getResponseBodyAsString();
            String errorMessage = String.format("OpenAI Whisper request failed with status %s. Response: %s", 
                ex.getStatusCode(), errorBody);
            throw new WhisperClientException(errorMessage, ex);
        } catch (IOException ex) {
            throw new WhisperClientException("Unable to parse Whisper response", ex);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record VerboseJsonResponse(String id, String text, String language, Double duration, String model) {
    }
}
