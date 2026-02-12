package com.decisiondesk.backend.api.v1.people;

/**
 * Request body for creating or updating a person.
 */
public record PersonRequest(
    String displayName,
    String fullName,
    String email,
    String notes
) {}
