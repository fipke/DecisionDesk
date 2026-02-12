package com.decisiondesk.backend.meetings.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import com.decisiondesk.backend.meetings.WhisperModel;

/**
 * ProcessBuilder-based implementation of LocalWhisperService.
 * 
 * <p>Executes whisper.cpp CLI to transcribe audio files. Requires whisper.cpp
 * to be installed and configured via application properties.</p>
 * 
 * <p>Configuration:</p>
 * <ul>
 *   <li>{@code transcription.local.enabled=true} - enable this service</li>
 *   <li>{@code transcription.local.whisper-path} - path to whisper executable</li>
 *   <li>{@code transcription.local.models-path} - path to models directory</li>
 *   <li>{@code transcription.local.timeout-minutes} - max processing time (default: 30)</li>
 * </ul>
 */
@Service
@ConditionalOnProperty(name = "transcription.local.enabled", havingValue = "true")
public class ProcessBuilderWhisperService implements LocalWhisperService {

    private static final Logger log = LoggerFactory.getLogger(ProcessBuilderWhisperService.class);

    private final Path whisperPath;
    private final Path modelsPath;
    private final int timeoutMinutes;

    public ProcessBuilderWhisperService(
            @Value("${transcription.local.whisper-path}") String whisperPath,
            @Value("${transcription.local.models-path}") String modelsPath,
            @Value("${transcription.local.timeout-minutes:30}") int timeoutMinutes) {
        this.whisperPath = Path.of(whisperPath);
        this.modelsPath = Path.of(modelsPath);
        this.timeoutMinutes = timeoutMinutes;

        if (!isAvailable()) {
            log.warn("Local whisper service configured but whisper executable not found at: {}", whisperPath);
        } else {
            log.info("Local whisper service initialized: whisper={}, models={}", whisperPath, modelsPath);
        }
    }

    @Override
    public LocalWhisperResult transcribe(Path audioPath, WhisperModel model, String language, boolean enableDiarization)
            throws LocalWhisperException {
        
        if (!isAvailable()) {
            throw new LocalWhisperException("Whisper executable not found at: " + whisperPath);
        }

        Path modelFile = modelsPath.resolve(model.getModelFile());
        if (!Files.exists(modelFile)) {
            throw new LocalWhisperException("Whisper model not found: " + modelFile);
        }

        if (!Files.exists(audioPath)) {
            throw new LocalWhisperException("Audio file not found: " + audioPath);
        }

        long startTime = System.currentTimeMillis();

        List<String> command = buildCommand(audioPath, modelFile, language, enableDiarization);
        log.info("Executing whisper: {}", String.join(" ", command));

        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                    log.debug("whisper: {}", line);
                }
            }

            boolean finished = process.waitFor(timeoutMinutes, TimeUnit.MINUTES);
            if (!finished) {
                process.destroyForcibly();
                throw new LocalWhisperException("Whisper transcription timed out after " + timeoutMinutes + " minutes");
            }

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                throw new LocalWhisperException("Whisper failed with exit code " + exitCode + ": " + output);
            }

            long processingTimeMs = System.currentTimeMillis() - startTime;
            String text = parseTranscriptionOutput(output.toString());
            
            // Estimate duration based on file size (rough approximation)
            // For accurate duration, whisper output should include timing info
            BigDecimal durationMinutes = estimateDuration(audioPath);

            log.info("Transcription completed in {}ms for {} minutes of audio", processingTimeMs, durationMinutes);

            return LocalWhisperResult.of(text, language, durationMinutes, processingTimeMs);

        } catch (IOException ex) {
            throw new LocalWhisperException("Failed to execute whisper: " + ex.getMessage(), ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new LocalWhisperException("Whisper transcription interrupted", ex);
        }
    }

    @Override
    public boolean isAvailable() {
        return Files.isExecutable(whisperPath);
    }

    @Override
    public Path getWhisperPath() {
        return whisperPath;
    }

    @Override
    public Path getModelsPath() {
        return modelsPath;
    }

    private List<String> buildCommand(Path audioPath, Path modelFile, String language, boolean enableDiarization) {
        List<String> command = new ArrayList<>();
        command.add(whisperPath.toString());
        command.add("-m");
        command.add(modelFile.toString());
        command.add("-f");
        command.add(audioPath.toString());
        command.add("-l");
        command.add(language);
        command.add("--output-txt");
        command.add("-nt"); // no timestamps in output text
        
        if (enableDiarization) {
            command.add("--diarize");
        }

        return command;
    }

    private String parseTranscriptionOutput(String output) {
        // whisper.cpp outputs various logging info followed by the transcript
        // The actual transcript is typically at the end
        // This is a simplified parser - production would need more robust parsing
        StringBuilder transcript = new StringBuilder();
        boolean foundStart = false;
        
        for (String line : output.split("\n")) {
            // Skip whisper logging lines
            if (line.startsWith("whisper_") || line.startsWith("[") || line.startsWith("main:") || 
                line.startsWith("ggml_") || line.startsWith("model:") || line.contains("sampling")) {
                continue;
            }
            
            if (!line.isBlank()) {
                foundStart = true;
                transcript.append(line).append("\n");
            }
        }
        
        return transcript.toString().trim();
    }

    private BigDecimal estimateDuration(Path audioPath) {
        try {
            long sizeBytes = Files.size(audioPath);
            // Rough estimation: AAC at 96kbps = 12KB/sec = 720KB/min
            // This is approximate - actual duration should come from ffprobe or whisper output
            BigDecimal minutes = BigDecimal.valueOf(sizeBytes)
                    .divide(BigDecimal.valueOf(720 * 1024), 2, RoundingMode.HALF_UP);
            return minutes.max(BigDecimal.valueOf(0.1)); // minimum 0.1 minutes
        } catch (IOException ex) {
            return BigDecimal.ONE;
        }
    }
}
