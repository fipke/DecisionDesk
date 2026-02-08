package com.decisiondesk.backend.meetings;

/**
 * Lifecycle states for a meeting as it progresses through transcription.
 */
public enum MeetingStatus {
    NEW,
    PROCESSING,
    DONE,
    ERROR
}
