package com.decisiondesk.backend.meetings.service;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.decisiondesk.backend.config.AppProps;
import com.decisiondesk.backend.cost.WhisperCostCalculator;
import com.decisiondesk.backend.cost.WhisperCostEstimate;
import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.model.AudioAsset;
import com.decisiondesk.backend.meetings.model.Transcript;
import com.decisiondesk.backend.meetings.model.UsageRecord;
import com.decisiondesk.backend.meetings.persistence.AudioAssetRepository;
import com.decisiondesk.backend.meetings.persistence.MeetingRepository;
import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.meetings.persistence.UsageRecordRepository;
import com.decisiondesk.backend.openai.WhisperClient;
import com.decisiondesk.backend.openai.WhisperClientException;
import com.decisiondesk.backend.openai.WhisperTranscription;
import com.decisiondesk.backend.web.ApiException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Coordinates transcription of stored meeting audio via the configured provider.
 */
@Service
public class TranscriptionService implements TranscriptionOperations {

    private static final String DEFAULT_PROVIDER = "remote_openai";

    private final MeetingRepository meetingRepository;
    private final AudioAssetRepository audioAssetRepository;
    private final TranscriptRepository transcriptRepository;
    private final UsageRecordRepository usageRecordRepository;
    private final WhisperClient whisperClient;
    private final WhisperCostCalculator costCalculator;
    private final AppProps appProps;
    private final ObjectMapper objectMapper;

    public TranscriptionService(MeetingRepository meetingRepository,
                                AudioAssetRepository audioAssetRepository,
                                TranscriptRepository transcriptRepository,
                                UsageRecordRepository usageRecordRepository,
                                WhisperClient whisperClient,
                                WhisperCostCalculator costCalculator,
                                AppProps appProps,
                                ObjectMapper objectMapper) {
        this.meetingRepository = meetingRepository;
        this.audioAssetRepository = audioAssetRepository;
        this.transcriptRepository = transcriptRepository;
        this.usageRecordRepository = usageRecordRepository;
        this.whisperClient = whisperClient;
        this.costCalculator = costCalculator;
        this.appProps = appProps;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public MeetingStatus transcribe(UUID meetingId) {
        Objects.requireNonNull(meetingId, "meetingId");

        meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", "Meeting %s not found".formatted(meetingId)));

        AudioAsset asset = audioAssetRepository.findLatestByMeetingId(meetingId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_REQUEST",
                        "Meeting %s has no audio to transcribe".formatted(meetingId)));

        meetingRepository.updateStatus(meetingId, MeetingStatus.PROCESSING);

        try {
            Path audioPath = Path.of(asset.path());
            WhisperTranscription transcription = whisperClient.transcribe(
                    audioPath,
                    audioPath.getFileName().toString(),
                    detectContentType(audioPath),
                    appProps.ai().defaultLanguage());

            String language = Optional.ofNullable(transcription.language())
                    .filter(l -> !l.isBlank())
                    .orElse(appProps.ai().defaultLanguage());

            Transcript transcript = new Transcript(
                    UUID.randomUUID(),
                    meetingId,
                    language,
                    transcription.text(),
                    OffsetDateTime.now(ZoneOffset.UTC));
            transcriptRepository.upsert(transcript);

            WhisperCostEstimate estimate = calculateCost(transcription);
            String usageMeta = buildUsageMeta(transcription, estimate);
            UsageRecord usageRecord = new UsageRecord(
                    UUID.randomUUID(),
                    meetingId,
                    UsageRecord.Service.WHISPER,
                    estimate.minutesBilled(),
                    estimate.usdCost(),
                    estimate.brlCost(),
                    usageMeta,
                    OffsetDateTime.now(ZoneOffset.UTC));
            usageRecordRepository.insert(usageRecord);

            meetingRepository.updateStatus(meetingId, MeetingStatus.DONE);
            return MeetingStatus.DONE;
        } catch (WhisperClientException ex) {
            meetingRepository.updateStatus(meetingId, MeetingStatus.ERROR);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "OPENAI_WHISPER_FAILED", ex.getMessage(), ex);
        } catch (JsonProcessingException ex) {
            meetingRepository.updateStatus(meetingId, MeetingStatus.ERROR);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to serialize transcription usage metadata", ex);
        } catch (RuntimeException ex) {
            meetingRepository.updateStatus(meetingId, MeetingStatus.ERROR);
            throw ex;
        }
    }

    private WhisperCostEstimate calculateCost(WhisperTranscription transcription) {
        Double durationSeconds = transcription.durationSeconds();
        if (durationSeconds == null || durationSeconds <= 0) {
            return costCalculator.estimateFromMinutes(BigDecimal.ONE);
        }
        BigDecimal minutes = BigDecimal.valueOf(durationSeconds)
                .divide(BigDecimal.valueOf(60), 6, RoundingMode.HALF_UP);
        return costCalculator.estimateFromMinutes(minutes);
    }

    private String buildUsageMeta(WhisperTranscription transcription, WhisperCostEstimate estimate) throws JsonProcessingException {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("provider", DEFAULT_PROVIDER);
        meta.put("responseId", transcription.id());
        meta.put("model", transcription.model());
        meta.put("durationSeconds", transcription.durationSeconds());
        meta.put("minutesBilled", estimate.minutesBilled());
        return objectMapper.writeValueAsString(meta);
    }

    private String detectContentType(Path path) {
        try {
            return Files.probeContentType(path);
        } catch (IOException ex) {
            return null;
        }
    }
}
