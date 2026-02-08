package com.decisiondesk.backend.openai;

import java.nio.file.Path;

/**
 * Contract for invoking OpenAI Whisper transcriptions.
 */
public interface WhisperClient {

    /** Model identifier used by the service. */
    String DEFAULT_MODEL = "whisper-1";

    /**
     * Executes a synchronous transcription request.
     *
     * @param audioPath path to the audio file saved locally
     * @param originalFilename filename reported to the API
     * @param contentType HTTP content type for the payload
     * @param language desired transcription language (BCP-47)
     * @return parsed Whisper response
     */
    WhisperTranscription transcribe(Path audioPath, String originalFilename, String contentType, String language);
}
