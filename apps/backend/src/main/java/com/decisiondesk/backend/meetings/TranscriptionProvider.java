package com.decisiondesk.backend.meetings;

/**
 * Transcription provider options.
 * 
 * <ul>
 *   <li>{@link #REMOTE_OPENAI} - OpenAI Whisper API (cloud, paid)</li>
 *   <li>{@link #SERVER_LOCAL} - whisper.cpp running on server/VPS (free, lower latency)</li>
 *   <li>{@link #DESKTOP_LOCAL} - whisper.cpp on Mac desktop (free, best privacy, queued)</li>
 * </ul>
 */
public enum TranscriptionProvider {
    /**
     * OpenAI Whisper API - cloud-based, paid per minute.
     */
    REMOTE_OPENAI("remote_openai"),
    
    /**
     * whisper.cpp running on the server or VPS - free, processed immediately.
     */
    SERVER_LOCAL("server_local"),
    
    /**
     * whisper.cpp on Mac desktop - free, best privacy, jobs go to queue.
     */
    DESKTOP_LOCAL("desktop_local");

    private final String value;

    TranscriptionProvider(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    /**
     * Parse provider from string value.
     *
     * @param value the string representation (e.g., "remote_openai")
     * @return the corresponding enum constant
     * @throws IllegalArgumentException if value is not recognized
     */
    public static TranscriptionProvider fromValue(String value) {
        for (TranscriptionProvider provider : values()) {
            if (provider.value.equals(value)) {
                return provider;
            }
        }
        throw new IllegalArgumentException("Unknown transcription provider: " + value);
    }
}
