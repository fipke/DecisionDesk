package com.decisiondesk.backend.meetings;

import java.nio.file.Path;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import com.decisiondesk.backend.meetings.model.AudioAsset;
import com.decisiondesk.backend.meetings.persistence.AudioAssetRepository;

/**
 * Backfills {@code duration_sec} for audio assets that were uploaded
 * before ffprobe extraction was added at upload time.
 * <p>
 * Runs automatically on startup and can also be triggered on demand
 * via the admin endpoint.
 */
@Service
public class DurationBackfillService {

    private static final Logger log = LoggerFactory.getLogger(DurationBackfillService.class);

    private final AudioAssetRepository audioAssetRepository;
    private final AudioDurationExtractor durationExtractor;

    public DurationBackfillService(AudioAssetRepository audioAssetRepository,
                                   AudioDurationExtractor durationExtractor) {
        this.audioAssetRepository = audioAssetRepository;
        this.durationExtractor = durationExtractor;
    }

    /**
     * Runs on application startup to backfill any assets missing duration.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void backfillOnStartup() {
        BackfillResult result = backfill();
        if (result.total() > 0) {
            log.info("Duration backfill complete: {}/{} assets updated, {} failed",
                    result.updated(), result.total(), result.failed());
        }
    }

    /**
     * Scans all audio assets with {@code duration_sec IS NULL}, extracts
     * duration via ffprobe, and updates the database.
     *
     * @return summary of what was processed
     */
    public BackfillResult backfill() {
        List<AudioAsset> missing = audioAssetRepository.findAllWithNullDuration();
        if (missing.isEmpty()) {
            return new BackfillResult(0, 0, 0);
        }

        int updated = 0;
        int failed = 0;
        for (AudioAsset asset : missing) {
            Integer durationSec = durationExtractor.extractDurationSec(Path.of(asset.path()));
            if (durationSec != null) {
                audioAssetRepository.updateDuration(asset.id(), durationSec);
                log.debug("Backfilled duration for asset {}: {}s", asset.id(), durationSec);
                updated++;
            } else {
                log.warn("Could not extract duration for asset {} (path: {})", asset.id(), asset.path());
                failed++;
            }
        }

        return new BackfillResult(missing.size(), updated, failed);
    }

    /**
     * Result of a backfill run.
     *
     * @param total   number of assets with NULL duration
     * @param updated number successfully updated
     * @param failed  number where ffprobe could not extract duration
     */
    public record BackfillResult(int total, int updated, int failed) {}
}
