package com.decisiondesk.backend.meetings.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.meetings.model.AudioAsset;

/**
 * Repository that manages {@code audio_assets} records.
 */
@Repository
public class AudioAssetRepository {

    private final JdbcClient jdbcClient;

    public AudioAssetRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * Persists the provided audio asset metadata.
     *
     * @param asset asset to insert
     * @return the stored asset (including generated timestamps)
     */
    public AudioAsset save(AudioAsset asset) {
        jdbcClient.sql("""
                INSERT INTO audio_assets (id, meeting_id, path, codec, sample_rate, size_bytes, duration_sec)
                VALUES (:id, :meetingId, :path, :codec, :sampleRate, :sizeBytes, :durationSec)
                """)
                .param("id", asset.id())
                .param("meetingId", asset.meetingId())
                .param("path", asset.path())
                .param("codec", asset.codec())
                .param("sampleRate", asset.sampleRate())
                .param("sizeBytes", asset.sizeBytes())
                .param("durationSec", asset.durationSec())
                .update();
        return findById(asset.id()).orElseThrow();
    }

    /**
     * Fetches an audio asset by its identifier.
     */
    public Optional<AudioAsset> findById(UUID id) {
        return jdbcClient.sql("SELECT id, meeting_id, path, codec, sample_rate, size_bytes, duration_sec, created_at FROM audio_assets WHERE id = :id")
                .param("id", id)
                .query(this::mapAsset)
                .optional();
    }

    /**
     * Fetches the most recent audio asset stored for the meeting.
     */
    public Optional<AudioAsset> findLatestByMeetingId(UUID meetingId) {
        return jdbcClient.sql("""
                        SELECT id, meeting_id, path, codec, sample_rate, size_bytes, duration_sec, created_at
                        FROM audio_assets
                        WHERE meeting_id = :meetingId
                        ORDER BY created_at DESC
                        LIMIT 1
                        """)
                .param("meetingId", meetingId)
                .query(this::mapAsset)
                .optional();
    }

    /**
     * Updates the duration of an existing audio asset.
     *
     * @param id          asset identifier
     * @param durationSec duration in seconds
     * @return number of rows updated (0 or 1)
     */
    public int updateDuration(UUID id, int durationSec) {
        return jdbcClient.sql("UPDATE audio_assets SET duration_sec = :durationSec WHERE id = :id")
                .param("durationSec", durationSec)
                .param("id", id)
                .update();
    }

    /**
     * Returns all audio assets that have no duration recorded yet.
     */
    public java.util.List<AudioAsset> findAllWithNullDuration() {
        return jdbcClient.sql("""
                        SELECT id, meeting_id, path, codec, sample_rate, size_bytes, duration_sec, created_at
                        FROM audio_assets
                        WHERE duration_sec IS NULL
                        ORDER BY created_at
                        """)
                .query(this::mapAsset)
                .list();
    }

    private AudioAsset mapAsset(ResultSet rs, int rowNum) throws SQLException {
        return new AudioAsset(
                rs.getObject("id", UUID.class),
                rs.getObject("meeting_id", UUID.class),
                rs.getString("path"),
                rs.getString("codec"),
                (Integer) rs.getObject("sample_rate"),
                rs.getObject("size_bytes", Long.class),
                (Integer) rs.getObject("duration_sec"),
                rs.getObject("created_at", OffsetDateTime.class));
    }
}
