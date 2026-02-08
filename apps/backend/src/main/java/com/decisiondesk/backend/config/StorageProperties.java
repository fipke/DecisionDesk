package com.decisiondesk.backend.config;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Objects;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Storage-related configuration for persisting uploaded audio locally.
 */
@ConfigurationProperties(prefix = "storage")
public record StorageProperties(Path audioRoot) {

    public StorageProperties {
        Objects.requireNonNull(audioRoot, "storage.audio-root is required");
    }

    /**
     * Convenience factory that resolves a string path into a {@link Path} instance.
     *
     * @param path textual path value
     * @return resolved {@link StorageProperties}
     */
    public static StorageProperties fromString(String path) {
        return new StorageProperties(Paths.get(path));
    }
}
