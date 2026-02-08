package com.decisiondesk.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration mapping for OpenAI credentials.
 */
@ConfigurationProperties(prefix = "openai")
public record OpenAiProperties(String apiKey) {
}
