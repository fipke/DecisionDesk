package com.decisiondesk.backend.meetings;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.decisiondesk.backend.config.AppProps;
import com.decisiondesk.backend.meetings.model.AudioAsset;
import com.decisiondesk.backend.meetings.model.AudioUploadResult;
import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.model.MeetingCostBreakdown;
import com.decisiondesk.backend.meetings.model.MeetingDetails;
import com.decisiondesk.backend.meetings.model.Transcript;
import com.decisiondesk.backend.meetings.model.UsageRecord;
import com.decisiondesk.backend.meetings.persistence.AudioAssetRepository;
import com.decisiondesk.backend.meetings.persistence.MeetingRepository;
import com.decisiondesk.backend.meetings.persistence.SummaryRepository;
import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.meetings.persistence.UsageRecordRepository;
import com.decisiondesk.backend.meetings.service.TranscriptionOperations;
import com.decisiondesk.backend.web.ApiException;

/**
 * Handles meeting creation, audio storage, and read models.
 */
@Service
public class MeetingService {

    private final MeetingRepository meetingRepository;
    private final AudioAssetRepository audioAssetRepository;
    private final TranscriptRepository transcriptRepository;
    private final SummaryRepository summaryRepository;
    private final UsageRecordRepository usageRecordRepository;
    private final AudioStorageService storageService;
    private final MeetingCostAggregator costAggregator;
    private final AppProps appProps;
    private final TranscriptionOperations transcriptionService;

    public MeetingService(MeetingRepository meetingRepository,
                          AudioAssetRepository audioAssetRepository,
                          TranscriptRepository transcriptRepository,
                          @Qualifier("meetingsSummaryRepository") SummaryRepository summaryRepository,
                          UsageRecordRepository usageRecordRepository,
                          AudioStorageService storageService,
                          MeetingCostAggregator costAggregator,
                          AppProps appProps,
                          TranscriptionOperations transcriptionService) {
        this.meetingRepository = meetingRepository;
        this.audioAssetRepository = audioAssetRepository;
        this.transcriptRepository = transcriptRepository;
        this.summaryRepository = summaryRepository;
        this.usageRecordRepository = usageRecordRepository;
        this.storageService = storageService;
        this.costAggregator = costAggregator;
        this.appProps = appProps;
        this.transcriptionService = transcriptionService;
    }

    /**
     * Creates a new meeting shell.
     */
    public Meeting createMeeting() {
        return meetingRepository.create();
    }

    /**
     * Stores meeting audio and optionally triggers immediate transcription based on configuration.
     */
    @Transactional
    public AudioUploadResult uploadAudio(UUID meetingId, MultipartFile file) {
        meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "Meeting %s not found".formatted(meetingId)));

        validateFile(file);

        AudioStorageService.StoredAudio stored;
        try {
            stored = storageService.store(meetingId, file);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "UPLOAD_FAILED", "Failed to persist audio file", ex);
        }

        AudioAsset asset = new AudioAsset(
                stored.assetId(),
                meetingId,
                stored.path().toString(),
                inferCodec(stored.originalFilename()),
                null,
                stored.sizeBytes(),
                null,
                OffsetDateTime.now(ZoneOffset.UTC));
        AudioAsset persisted = audioAssetRepository.save(asset);

        meetingRepository.updateStatus(meetingId, MeetingStatus.NEW);
        return new AudioUploadResult(meetingId, persisted.id(), MeetingStatus.NEW);
    }

    /**
     * Retrieves the meeting read model presented by the API.
     */
    public MeetingDetails getMeeting(UUID meetingId) {
        Meeting meeting = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "Meeting %s not found".formatted(meetingId)));

        Optional<Transcript> transcript = transcriptRepository.findByMeetingId(meetingId);
        Optional<com.decisiondesk.backend.meetings.model.Summary> summary = summaryRepository.findByMeetingId(meetingId);
        List<UsageRecord> usageRecords = usageRecordRepository.findByMeetingId(meetingId);
        MeetingCostBreakdown costBreakdown = costAggregator.aggregate(usageRecords);

        return new MeetingDetails(meeting.id(), meeting.status(), meeting.createdAt(), transcript.orElse(null), summary.orElse(null), costBreakdown);
    }

    /**
     * Triggers transcription of the latest audio asset for the meeting.
     *
     * @param meetingId identifier of the meeting to process
     * @return resulting meeting status
     */
    @Transactional
    public MeetingStatus transcribeMeeting(UUID meetingId) {
        return transcriptionService.transcribe(meetingId);
    }

    /**
     * Triggers transcription of the latest audio asset with specified options.
     *
     * @param meetingId identifier of the meeting to process
     * @param options   transcription options (provider, model, diarization)
     * @return resulting meeting status
     */
    @Transactional
    public MeetingStatus transcribeMeeting(UUID meetingId, TranscriptionOptions options) {
        return transcriptionService.transcribe(meetingId, options);
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Audio file is required");
        }
        long maxBytes = appProps.upload().maxMb() * 1024L * 1024L;
        if (file.getSize() > maxBytes) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UPLOAD_TOO_LARGE", "Audio exceeds the configured limit of %d MB".formatted(appProps.upload().maxMb()));
        }
        if (!isSupportedContentType(file.getContentType(), file.getOriginalFilename())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AUDIO_FORMAT_UNSUPPORTED", "Unsupported audio content type");
        }
    }

    private boolean isSupportedContentType(String contentType, String filename) {
        if (contentType != null) {
            switch (contentType) {
                case "audio/mpeg":
                case "audio/mp4":
                case "audio/x-m4a":
                case "audio/aac":
                case "audio/wav":
                case "audio/x-wav":
                case "audio/webm":
                case "audio/ogg":
                case "audio/opus":
                    return true;
                default:
                    break;
            }
        }
        if (filename == null) {
            return false;
        }
        String lower = filename.toLowerCase(Locale.ROOT);
        return lower.endsWith(".m4a") || lower.endsWith(".aac") || lower.endsWith(".wav") || lower.endsWith(".mp3")
                || lower.endsWith(".webm") || lower.endsWith(".ogg") || lower.endsWith(".opus");
    }

    private String inferCodec(String filename) {
        if (filename == null) {
            return null;
        }
        String lower = filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".m4a")) {
            return "m4a";
        }
        if (lower.endsWith(".aac")) {
            return "aac";
        }
        if (lower.endsWith(".wav")) {
            return "wav";
        }
        if (lower.endsWith(".mp3")) {
            return "mp3";
        }
        if (lower.endsWith(".webm")) {
            return "webm";
        }
        if (lower.endsWith(".ogg")) {
            return "ogg";
        }
        if (lower.endsWith(".opus")) {
            return "opus";
        }
        return null;
    }
}
