package com.decisiondesk.backend.meetings.service;

import java.nio.file.Path;

import com.decisiondesk.backend.meetings.WhisperModel;

/**
 * Interface for local whisper.cpp transcription service.
 * 
 * <p>Implementations should run whisper.cpp via ProcessBuilder or JNI.</p>
 */
public interface LocalWhisperService {

    /**
     * Transcribe audio file using whisper.cpp.
     *
     * @param audioPath path to the audio file
     * @param model     whisper model to use
     * @param language  target language code (e.g., "pt", "en")
     * @param enableDiarization whether to perform speaker diarization
     * @return transcription result
     * @throws LocalWhisperException if transcription fails
     */
    LocalWhisperResult transcribe(Path audioPath, WhisperModel model, String language, boolean enableDiarization)
            throws LocalWhisperException;

    /**
     * Check if local whisper is available and properly configured.
     *
     * @return true if whisper.cpp is available
     */
    boolean isAvailable();

    /**
     * Get the path to the whisper.cpp executable.
     *
     * @return path to whisper executable
     */
    Path getWhisperPath();

    /**
     * Get the directory containing whisper models.
     *
     * @return path to models directory
     */
    Path getModelsPath();
}
