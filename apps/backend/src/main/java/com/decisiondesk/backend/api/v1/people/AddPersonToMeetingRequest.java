package com.decisiondesk.backend.api.v1.people;

import java.util.UUID;

/**
 * Request to add a person to a meeting.
 */
public record AddPersonToMeetingRequest(
    UUID personId,
    String role  // "participant" or "mentioned"
) {}
