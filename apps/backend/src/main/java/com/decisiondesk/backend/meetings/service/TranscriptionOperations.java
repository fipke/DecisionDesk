package com.decisiondesk.backend.meetings.service;

import java.util.UUID;

import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.TranscriptionOptions;

/**
 * Contract for manual transcription triggers.
 */
public interface TranscriptionOperations {

    /**
     * Transcribe meeting audio with default options.
     *
     * @param meetingId the meeting to transcribe
     * @return resulting meeting status
     */
    MeetingStatus transcribe(UUID meetingId);

    /**
     * Transcribe meeting audio with specified options.
     *
     * @param meetingId the meeting to transcribe
     * @param options   transcription options (provider, model, diarization)
     * @return resulting meeting status
     */
    MeetingStatus transcribe(UUID meetingId, TranscriptionOptions options);
}
