package com.decisiondesk.backend.meetings;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

import jakarta.annotation.PostConstruct;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.decisiondesk.backend.config.StorageProperties;

/**
 * Persists uploaded meeting audio onto the local filesystem.
 */
@Component
public class AudioStorageService {

    private final Path audioRoot;

    public AudioStorageService(StorageProperties storageProperties) {
        this.audioRoot = storageProperties.audioRoot();
    }

    @PostConstruct
    void ensureRootExists() throws IOException {
        Files.createDirectories(audioRoot);
    }

    /**
     * Stores the multipart payload under a meeting/asset specific directory.
     *
     * @param meetingId owning meeting identifier
     * @param file multipart payload provided by clients
     * @return metadata describing the stored asset
     * @throws IOException if the file cannot be persisted
     */
    public StoredAudio store(UUID meetingId, MultipartFile file) throws IOException {
        UUID assetId = UUID.randomUUID();
        String originalName = sanitize(file.getOriginalFilename());
        Path targetDirectory = audioRoot.resolve(meetingId.toString()).resolve(assetId.toString());
        Files.createDirectories(targetDirectory);
        Path destination = targetDirectory.resolve(originalName);

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, destination, StandardCopyOption.REPLACE_EXISTING);
        }

        return new StoredAudio(assetId, destination, file.getSize(), originalName, file.getContentType());
    }

    private String sanitize(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return "audio";
        }
        String filename = candidate;
        int separator = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
        if (separator != -1) {
            filename = filename.substring(separator + 1);
        }
        String normalized = Normalizer.normalize(filename, Normalizer.Form.NFD)
                .replaceAll("[^A-Za-z0-9._-]", "_");
        if (normalized.isBlank()) {
            return "audio";
        }
        return normalized.toLowerCase(Locale.ROOT);
    }

    /**
     * Value object representing a stored audio asset on disk.
     */
    public record StoredAudio(UUID assetId, Path path, long sizeBytes, String originalFilename, String contentType) {
    }
}
