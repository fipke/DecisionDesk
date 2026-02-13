package com.decisiondesk.backend.meetings.model;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Aggregate root representing a meeting captured by the client.
 * PR07: Added folder, type, tags, and title for organization.
 * PR-Notes: Added agenda, live_notes, post_notes, series linking, import source.
 */
public record Meeting(
    UUID id, 
    OffsetDateTime createdAt, 
    MeetingStatus status,
    UUID folderId,
    UUID meetingTypeId,
    Map<String, String> tags,
    String title,
    OffsetDateTime updatedAt,
    // PR-Notes: New fields
    String agenda,
    String liveNotes,
    String postNotes,
    UUID previousMeetingId,
    UUID seriesId,
    Integer sequenceNum,
    String importedTranscriptSource
) {
    
    /**
     * Creates a meeting with just the base fields (backward compatibility).
     */
    public Meeting(UUID id, OffsetDateTime createdAt, MeetingStatus status) {
        this(id, createdAt, status, null, null, Map.of(), null, createdAt, 
             null, null, null, null, null, null, null);
    }
    
    /**
     * Creates a meeting with PR07 fields (backward compatibility).
     */
    public Meeting(UUID id, OffsetDateTime createdAt, MeetingStatus status,
                   UUID folderId, UUID meetingTypeId, Map<String, String> tags,
                   String title, OffsetDateTime updatedAt) {
        this(id, createdAt, status, folderId, meetingTypeId, tags, title, updatedAt,
             null, null, null, null, null, null, null);
    }
    
    /**
     * Returns a new meeting with updated folder.
     */
    public Meeting withFolderId(UUID newFolderId) {
        return new Meeting(id, createdAt, status, newFolderId, meetingTypeId, tags, title, OffsetDateTime.now(),
                agenda, liveNotes, postNotes, previousMeetingId, seriesId, sequenceNum, importedTranscriptSource);
    }
    
    /**
     * Returns a new meeting with updated meeting type.
     */
    public Meeting withMeetingTypeId(UUID newMeetingTypeId) {
        return new Meeting(id, createdAt, status, folderId, newMeetingTypeId, tags, title, OffsetDateTime.now(),
                agenda, liveNotes, postNotes, previousMeetingId, seriesId, sequenceNum, importedTranscriptSource);
    }
    
    /**
     * Returns a new meeting with updated tags.
     */
    public Meeting withTags(Map<String, String> newTags) {
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, newTags, title, OffsetDateTime.now(),
                agenda, liveNotes, postNotes, previousMeetingId, seriesId, sequenceNum, importedTranscriptSource);
    }
    
    /**
     * Returns a new meeting with updated title.
     */
    public Meeting withTitle(String newTitle) {
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, tags, newTitle, OffsetDateTime.now(),
                agenda, liveNotes, postNotes, previousMeetingId, seriesId, sequenceNum, importedTranscriptSource);
    }
    
    /**
     * Returns a new meeting with updated agenda.
     */
    public Meeting withAgenda(String newAgenda) {
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, tags, title, OffsetDateTime.now(),
                newAgenda, liveNotes, postNotes, previousMeetingId, seriesId, sequenceNum, importedTranscriptSource);
    }
    
    /**
     * Returns a new meeting with updated live notes.
     */
    public Meeting withLiveNotes(String newLiveNotes) {
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, tags, title, OffsetDateTime.now(),
                agenda, newLiveNotes, postNotes, previousMeetingId, seriesId, sequenceNum, importedTranscriptSource);
    }
    
    /**
     * Returns a new meeting with updated post notes.
     */
    public Meeting withPostNotes(String newPostNotes) {
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, tags, title, OffsetDateTime.now(),
                agenda, liveNotes, newPostNotes, previousMeetingId, seriesId, sequenceNum, importedTranscriptSource);
    }
    
    /**
     * Returns a new meeting linked to a previous meeting.
     */
    public Meeting withPreviousMeetingId(UUID newPreviousMeetingId) {
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, tags, title, OffsetDateTime.now(),
                agenda, liveNotes, postNotes, newPreviousMeetingId, seriesId, sequenceNum, importedTranscriptSource);
    }
    
    /**
     * Returns a new meeting with series assignment.
     */
    public Meeting withSeries(UUID newSeriesId, Integer newSequenceNum) {
        return new Meeting(id, createdAt, status, folderId, meetingTypeId, tags, title, OffsetDateTime.now(),
                agenda, liveNotes, postNotes, previousMeetingId, newSeriesId, newSequenceNum, importedTranscriptSource);
    }
}
