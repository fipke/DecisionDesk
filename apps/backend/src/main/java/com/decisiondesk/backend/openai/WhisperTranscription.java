package com.decisiondesk.backend.openai;

/**
 * Minimal subset of the Whisper response used by the backend.
 *
 * @param id OpenAI response identifier
 * @param text transcribed text content
 * @param language detected or forced language code
 * @param durationSeconds optional duration hint returned by the API
 * @param model model identifier used for the transcription
 */
public record WhisperTranscription(String id, String text, String language, Double durationSeconds, String model) {
}
