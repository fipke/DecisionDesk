package com.decisiondesk.backend.meetings.service;

import java.nio.file.Path;
import java.util.UUID;

import com.decisiondesk.backend.meetings.WhisperModel;

/**
 * Transcription job to be processed by the desktop app.
 *
 * @param meetingId    the meeting to transcribe
 * @param audioPath    path to the audio file on server
 * @param model        whisper model to use
 * @param language     target language code
 * @param enableDiarization whether to perform speaker diarization
 */
public record DesktopTranscriptionJob(
        UUID meetingId,
        Path audioPath,
        WhisperModel model,
        String language,
        boolean enableDiarization
) {}
