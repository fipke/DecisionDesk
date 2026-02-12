package com.decisiondesk.backend.meetings.service;

/**
 * Exception thrown when local whisper.cpp transcription fails.
 */
public class LocalWhisperException extends RuntimeException {

    public LocalWhisperException(String message) {
        super(message);
    }

    public LocalWhisperException(String message, Throwable cause) {
        super(message, cause);
    }
}
