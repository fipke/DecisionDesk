package com.decisiondesk.backend.api.v1.meetings;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Request body for the transcribe endpoint.
 *
 * @param provider the transcription provider (remote_openai, server_local, desktop_local)
 * @param model    the Whisper model for local providers (large-v3, medium, small, base, tiny)
 * @param enableDiarization whether to perform speaker diarization
 */
@Schema(description = "Transcription request options")
public record TranscribeRequest(
        @Schema(description = "Transcription provider", 
                allowableValues = {"remote_openai", "server_local", "desktop_local"},
                example = "desktop_local")
        String provider,

        @Schema(description = "Whisper model for local providers",
                allowableValues = {"large-v3", "medium", "small", "base", "tiny"},
                example = "large-v3")
        String model,

        @Schema(description = "Enable speaker diarization (pyannote)",
                example = "true")
        Boolean enableDiarization
) {
    /**
     * Returns provider or default value.
     */
    public String providerOrDefault() {
        return provider != null ? provider : "remote_openai";
    }

    /**
     * Returns model or default value.
     */
    public String modelOrDefault() {
        return model != null ? model : "large-v3";
    }

    /**
     * Returns enableDiarization or default value.
     */
    public boolean enableDiarizationOrDefault() {
        return enableDiarization != null && enableDiarization;
    }
}
