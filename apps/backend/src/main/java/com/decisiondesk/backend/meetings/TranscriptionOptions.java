package com.decisiondesk.backend.meetings;

/**
 * Options for transcription requests.
 *
 * @param provider the transcription provider to use
 * @param model the Whisper model (for local providers)
 * @param enableDiarization whether to perform speaker diarization
 */
public record TranscriptionOptions(
        TranscriptionProvider provider,
        WhisperModel model,
        boolean enableDiarization
) {
    /**
     * Default options using remote_openai provider.
     */
    public static TranscriptionOptions defaults() {
        return new TranscriptionOptions(
                TranscriptionProvider.REMOTE_OPENAI,
                WhisperModel.LARGE_V3,
                false
        );
    }

    /**
     * Create options for desktop_local with specified model.
     */
    public static TranscriptionOptions desktopLocal(WhisperModel model, boolean enableDiarization) {
        return new TranscriptionOptions(TranscriptionProvider.DESKTOP_LOCAL, model, enableDiarization);
    }

    /**
     * Create options for server_local with specified model.
     */
    public static TranscriptionOptions serverLocal(WhisperModel model, boolean enableDiarization) {
        return new TranscriptionOptions(TranscriptionProvider.SERVER_LOCAL, model, enableDiarization);
    }

    /**
     * Create options for remote_openai.
     */
    public static TranscriptionOptions remoteOpenai() {
        return new TranscriptionOptions(TranscriptionProvider.REMOTE_OPENAI, null, false);
    }
}
