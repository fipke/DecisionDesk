package com.decisiondesk.backend.config;

import java.util.Objects;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/**
 * Application-level configuration values shared across the service.
 *
 * @param version semantic version reported by health endpoints
 * @param upload upload-related limits configured for the API
 * @param ai AI-related defaults (e.g. Whisper language)
 * @param features feature toggles influencing runtime behavior
 */
@ConfigurationProperties(prefix = "app")
public record AppProps(String version, Upload upload, Ai ai, Features features) {

    /**
     * Validates the mapped configuration.
     */
    public AppProps {
        if (!StringUtils.hasText(version)) {
            throw new IllegalArgumentException("app.version must be provided");
        }
        Objects.requireNonNull(upload, "app.upload is required");
        Objects.requireNonNull(ai, "app.ai is required");
        Objects.requireNonNull(features, "app.features is required");
    }

    /**
     * Upload configuration for the HTTP API.
     *
     * @param maxMb maximum allowed upload size in megabytes
     */
    public record Upload(int maxMb) {

        public Upload {
            if (maxMb <= 0) {
                throw new IllegalArgumentException("app.upload.max-mb must be positive");
            }
        }
    }

    /**
     * AI defaults used when invoking OpenAI services.
     *
     * @param defaultLanguage BCP-47 language tag for Whisper
     */
    public record Ai(String defaultLanguage) {

        public Ai {
            if (!StringUtils.hasText(defaultLanguage)) {
                throw new IllegalArgumentException("app.ai.default-language must be provided");
            }
        }
    }

    /**
     * Feature toggles managed via configuration.
     *
     * @param autoTranscribeOnUpload whether uploads trigger Whisper immediately
     */
    public record Features(boolean autoTranscribeOnUpload) {

        public Features {
            if (autoTranscribeOnUpload) {
                throw new IllegalArgumentException("app.features.auto-transcribe-on-upload must remain false");
            }
        }
    }
}
