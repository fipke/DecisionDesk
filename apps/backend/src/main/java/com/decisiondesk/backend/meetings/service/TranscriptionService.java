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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.decisiondesk.backend.config.AppProps;
import com.decisiondesk.backend.cost.WhisperCostCalculator;
import com.decisiondesk.backend.cost.WhisperCostEstimate;
import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.TranscriptionOptions;
import com.decisiondesk.backend.meetings.TranscriptionProvider;
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
 * 
 * <p>Supports three providers:</p>
 * <ul>
 *   <li>{@code REMOTE_OPENAI} - OpenAI Whisper API (cloud, paid)</li>
 *   <li>{@code SERVER_LOCAL} - whisper.cpp on server/VPS (free, immediate)</li>
 *   <li>{@code DESKTOP_LOCAL} - whisper.cpp on Mac (free, queued)</li>
 * </ul>
 */
@Service
public class TranscriptionService implements TranscriptionOperations {

    private static final Logger log = LoggerFactory.getLogger(TranscriptionService.class);

    private final MeetingRepository meetingRepository;
    private final AudioAssetRepository audioAssetRepository;
    private final TranscriptRepository transcriptRepository;
    private final UsageRecordRepository usageRecordRepository;
    private final WhisperClient whisperClient;
    private final WhisperCostCalculator costCalculator;
    private final AppProps appProps;
    private final ObjectMapper objectMapper;
    private final Optional<LocalWhisperService> localWhisperService;
    private final Optional<DesktopQueueService> desktopQueueService;

    public TranscriptionService(MeetingRepository meetingRepository,
                                AudioAssetRepository audioAssetRepository,
                                TranscriptRepository transcriptRepository,
                                UsageRecordRepository usageRecordRepository,
                                WhisperClient whisperClient,
                                WhisperCostCalculator costCalculator,
                                AppProps appProps,
                                ObjectMapper objectMapper,
                                Optional<LocalWhisperService> localWhisperService,
                                Optional<DesktopQueueService> desktopQueueService) {
        this.meetingRepository = meetingRepository;
        this.audioAssetRepository = audioAssetRepository;
        this.transcriptRepository = transcriptRepository;
        this.usageRecordRepository = usageRecordRepository;
        this.whisperClient = whisperClient;
        this.costCalculator = costCalculator;
        this.appProps = appProps;
        this.objectMapper = objectMapper;
        this.localWhisperService = localWhisperService;
        this.desktopQueueService = desktopQueueService;
    }

    @Override
    @Transactional
    public MeetingStatus transcribe(UUID meetingId) {
        return transcribe(meetingId, TranscriptionOptions.defaults());
    }

    @Override
    @Transactional
    public MeetingStatus transcribe(UUID meetingId, TranscriptionOptions options) {
        Objects.requireNonNull(meetingId, "meetingId");
        Objects.requireNonNull(options, "options");

        log.info("Transcribing meeting {} with provider={}, model={}, diarization={}",
                meetingId, options.provider(), options.model(), options.enableDiarization());

        meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEETING_NOT_FOUND", 
                        "Meeting %s not found".formatted(meetingId)));

        AudioAsset asset = audioAssetRepository.findLatestByMeetingId(meetingId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_REQUEST",
                        "Meeting %s has no audio to transcribe".formatted(meetingId)));

        return switch (options.provider()) {
            case REMOTE_OPENAI -> transcribeWithOpenAI(meetingId, asset);
            case SERVER_LOCAL -> transcribeWithServerLocal(meetingId, asset, options);
            case DESKTOP_LOCAL -> queueForDesktop(meetingId, asset, options);
        };
    }

    /**
     * Transcribes using OpenAI Whisper API (cloud).
     */
    private MeetingStatus transcribeWithOpenAI(UUID meetingId, AudioAsset asset) {
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
            String usageMeta = buildUsageMeta(TranscriptionProvider.REMOTE_OPENAI, transcription, estimate);
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
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "DB_ERROR", 
                    "Failed to serialize transcription usage metadata", ex);
        } catch (RuntimeException ex) {
            meetingRepository.updateStatus(meetingId, MeetingStatus.ERROR);
            throw ex;
        }
    }

    /**
     * Transcribes using local whisper.cpp on the server.
     */
    private MeetingStatus transcribeWithServerLocal(UUID meetingId, AudioAsset asset, TranscriptionOptions options) {
        LocalWhisperService service = localWhisperService
                .orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 
                        "PROVIDER_UNAVAILABLE", "server_local provider is not configured"));

        meetingRepository.updateStatus(meetingId, MeetingStatus.PROCESSING);

        try {
            LocalWhisperResult result = service.transcribe(
                    Path.of(asset.path()),
                    options.model(),
                    appProps.ai().defaultLanguage(),
                    options.enableDiarization());

            Transcript transcript = new Transcript(
                    UUID.randomUUID(),
                    meetingId,
                    result.language(),
                    result.text(),
                    OffsetDateTime.now(ZoneOffset.UTC));
            transcriptRepository.upsert(transcript);

            // Local transcription is free - record zero cost
            String usageMeta = buildLocalUsageMeta(TranscriptionProvider.SERVER_LOCAL, options, result);
            UsageRecord usageRecord = new UsageRecord(
                    UUID.randomUUID(),
                    meetingId,
                    UsageRecord.Service.WHISPER,
                    result.durationMinutes(),
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    usageMeta,
                    OffsetDateTime.now(ZoneOffset.UTC));
            usageRecordRepository.insert(usageRecord);

            meetingRepository.updateStatus(meetingId, MeetingStatus.DONE);
            return MeetingStatus.DONE;
        } catch (LocalWhisperException ex) {
            meetingRepository.updateStatus(meetingId, MeetingStatus.ERROR);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "LOCAL_WHISPER_FAILED", ex.getMessage(), ex);
        } catch (JsonProcessingException ex) {
            meetingRepository.updateStatus(meetingId, MeetingStatus.ERROR);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "DB_ERROR", 
                    "Failed to serialize transcription usage metadata", ex);
        } catch (RuntimeException ex) {
            meetingRepository.updateStatus(meetingId, MeetingStatus.ERROR);
            throw ex;
        }
    }

    /**
     * Queues transcription for desktop processing.
     * Returns PROCESSING status - the desktop app will POST the result back.
     */
    private MeetingStatus queueForDesktop(UUID meetingId, AudioAsset asset, TranscriptionOptions options) {
        DesktopQueueService service = desktopQueueService
                .orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 
                        "PROVIDER_UNAVAILABLE", "desktop_local provider is not configured"));

        meetingRepository.updateStatus(meetingId, MeetingStatus.PROCESSING);
        
        service.enqueue(new DesktopTranscriptionJob(
                meetingId,
                Path.of(asset.path()),
                options.model(),
                appProps.ai().defaultLanguage(),
                options.enableDiarization()));

        log.info("Meeting {} queued for desktop transcription", meetingId);
        return MeetingStatus.PROCESSING;
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

    private String buildUsageMeta(TranscriptionProvider provider, WhisperTranscription transcription, 
                                   WhisperCostEstimate estimate) throws JsonProcessingException {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("provider", provider.getValue());
        meta.put("responseId", transcription.id());
        meta.put("model", transcription.model());
        meta.put("durationSeconds", transcription.durationSeconds());
        meta.put("minutesBilled", estimate.minutesBilled());
        return objectMapper.writeValueAsString(meta);
    }

    private String buildLocalUsageMeta(TranscriptionProvider provider, TranscriptionOptions options,
                                        LocalWhisperResult result) throws JsonProcessingException {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("provider", provider.getValue());
        meta.put("model", options.model().getValue());
        meta.put("durationSeconds", result.durationMinutes().multiply(BigDecimal.valueOf(60)));
        meta.put("diarization", options.enableDiarization());
        meta.put("processingTimeMs", result.processingTimeMs());
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
