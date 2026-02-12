package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Aggregate root representing a meeting captured by the client.
 * PR07: Added folder, type, tags, and title for organization.
 */
public record Meeting(
    UUID id, 
    OffsetDateTime createdAt, 
    MeetingStatus status,
    UUID folderId,
    UUID meetingTypeId,
    Map<String, String> tags,
    String title,
    OffsetDateTime updatedAt
) {
    
    /**
     * Creates a meeting with just the base fields (backward compatibility).
     */
    public Meeting(UUID id, OffsetDateTime createdAt, MeetingStatus status) {
        this(id, createdAt, status, null, null, Map.of(), null, createdAt);
    }
    
    /**
     * Returns a new meeting with updated folder.
     */
    public Meeting withFolderId(UUID newFolderId) {
        return new Meeting(id, createdAt, status, newFolderId, meetingTypeId, tags, title, OffsetDateTime.now());
    }
    
    /**
     * Returns a new meeting with updated meeting type.
     */
    public Meeting withMeetingTypeId(UUID newMeetingTypeId) {
        return new Meeting(id, createdAt, status, folderId, newMeetingTypeId, tags, title, OffsetDateTime.now());
    }
    
    /**
     * Returns a new meeting with updated tags.
     */
    public Meeting withTags(Map<String, String> newTags) {
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, newTags, title, OffsetDateTime.now());
    }
    
    /**
     * Returns a new meeting with updated title.
     */
    public Meeting withTitle(String newTitle) {
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, tags, newTitle, OffsetDateTime.now());
    }
}
