package com.decisiondesk.backend.web;

import java.time.OffsetDateTime;

/**
 * JSON structure returned when an API call fails.
 */
public record ApiErrorResponse(String code, String message, OffsetDateTime timestamp) {

    public static ApiErrorResponse of(String code, String message) {
        return new ApiErrorResponse(code, message, OffsetDateTime.now());
    }
}
