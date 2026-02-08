package com.decisiondesk.backend.meetings.service;

import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;

/**
 * Contract for manual transcription triggers.
 */
public interface TranscriptionOperations {

    MeetingStatus transcribe(UUID meetingId);
}
