package com.decisiondesk.backend.meetings;

import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Extracts audio duration from a file using {@code ffprobe}.
 * <p>
 * Falls back gracefully to {@code null} when ffprobe is not installed
 * or the file format is not supported.
 */
@Component
public class AudioDurationExtractor {

    private static final Logger log = LoggerFactory.getLogger(AudioDurationExtractor.class);
    private static final int TIMEOUT_SECONDS = 10;

    /**
     * Probes the audio file and returns its duration in whole seconds.
     *
     * @param audioPath path to the audio file on disk
     * @return duration in seconds, or {@code null} if extraction fails
     */
    public Integer extractDurationSec(Path audioPath) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "ffprobe",
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    audioPath.toString());
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes()).trim();
            boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                log.warn("ffprobe timed out for {}", audioPath);
                return null;
            }

            if (process.exitValue() != 0 || output.isBlank()) {
                log.debug("ffprobe returned exit code {} for {}", process.exitValue(), audioPath);
                return null;
            }

            double seconds = Double.parseDouble(output);
            return (int) Math.round(seconds);
        } catch (Exception e) {
            log.debug("Could not extract audio duration from {}: {}", audioPath, e.getMessage());
            return null;
        }
    }
}
