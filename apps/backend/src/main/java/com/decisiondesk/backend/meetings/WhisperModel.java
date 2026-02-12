package com.decisiondesk.backend.meetings;

/**
 * Whisper model options for local transcription.
 * 
 * <p>Larger models are more accurate but slower. For server_local on VPS,
 * consider using small or medium models. For desktop_local on M3 Max,
 * large-v3 runs at ~15x realtime.</p>
 */
public enum WhisperModel {
    /**
     * Large V3 - 4GB, ~15x realtime on M3 Max, best accuracy.
     */
    LARGE_V3("large-v3", "ggml-large-v3.bin"),

    /**
     * Medium - 2GB, ~30x realtime, great accuracy.
     */
    MEDIUM("medium", "ggml-medium.bin"),

    /**
     * Small - 1GB, ~45x realtime, good accuracy.
     */
    SMALL("small", "ggml-small.bin"),

    /**
     * Base - 142MB, ~100x realtime, acceptable accuracy.
     */
    BASE("base", "ggml-base.bin"),

    /**
     * Tiny - 75MB, ~150x realtime, basic accuracy.
     */
    TINY("tiny", "ggml-tiny.bin");

    private final String value;
    private final String modelFile;

    WhisperModel(String value, String modelFile) {
        this.value = value;
        this.modelFile = modelFile;
    }

    public String getValue() {
        return value;
    }

    public String getModelFile() {
        return modelFile;
    }

    /**
     * Parse model from string value.
     *
     * @param value the string representation (e.g., "large-v3")
     * @return the corresponding enum constant
     * @throws IllegalArgumentException if value is not recognized
     */
    public static WhisperModel fromValue(String value) {
        for (WhisperModel model : values()) {
            if (model.value.equals(value)) {
                return model;
            }
        }
        throw new IllegalArgumentException("Unknown whisper model: " + value);
    }
}
