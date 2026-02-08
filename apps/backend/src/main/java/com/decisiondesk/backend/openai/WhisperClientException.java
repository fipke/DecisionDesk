package com.decisiondesk.backend.openai;

/**
 * Raised when the OpenAI Whisper call fails or returns an unexpected payload.
 */
public class WhisperClientException extends RuntimeException {

    public WhisperClientException(String message) {
        super(message);
    }

    public WhisperClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
