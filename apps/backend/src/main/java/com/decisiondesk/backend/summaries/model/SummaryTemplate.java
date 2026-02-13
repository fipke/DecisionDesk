package com.decisiondesk.backend.summaries.model;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Represents a summary template used to generate meeting summaries with GPT.
 */
public record SummaryTemplate(
    UUID id,
    String name,
    String description,
    String systemPrompt,
    String userPromptTemplate,
    String outputFormat,
    String model,
    Integer maxTokens,
    BigDecimal temperature,
    boolean isDefault,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    
    public static final String DEFAULT_MODEL = "gpt-4o";
    public static final String DEFAULT_OUTPUT_FORMAT = "markdown";
    public static final int DEFAULT_MAX_TOKENS = 2000;
    public static final BigDecimal DEFAULT_TEMPERATURE = new BigDecimal("0.3");

    /**
     * Creates a new template with required fields.
     */
    public static SummaryTemplate create(
        String name,
        String systemPrompt,
        String userPromptTemplate
    ) {
        return new SummaryTemplate(
            UUID.randomUUID(),
            name,
            null,
            systemPrompt,
            userPromptTemplate,
            DEFAULT_OUTPUT_FORMAT,
            DEFAULT_MODEL,
            DEFAULT_MAX_TOKENS,
            DEFAULT_TEMPERATURE,
            false,
            OffsetDateTime.now(),
            OffsetDateTime.now()
        );
    }

    /**
     * Returns the user prompt with transcript substituted.
     */
    public String buildUserPrompt(String transcript) {
        return userPromptTemplate.replace("{{transcript}}", transcript);
    }
}
