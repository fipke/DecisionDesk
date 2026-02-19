package com.decisiondesk.backend.api.v1.meetings;

import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.decisiondesk.backend.ai.AiExtractionService;
import com.decisiondesk.backend.meetings.MeetingService;
import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.TranscriptionOptions;
import com.decisiondesk.backend.meetings.TranscriptionProvider;
import com.decisiondesk.backend.meetings.WhisperModel;
import com.decisiondesk.backend.meetings.model.AudioAsset;
import com.decisiondesk.backend.meetings.model.AudioUploadResult;
import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.model.MeetingCostBreakdown;
import com.decisiondesk.backend.meetings.model.MeetingDetails;
import com.decisiondesk.backend.meetings.persistence.AudioAssetRepository;
import com.decisiondesk.backend.summaries.model.Summary;
import com.decisiondesk.backend.summaries.service.SummaryService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

/**
 * REST controller covering PR02 meeting endpoints.
 */
@RestController
@RequestMapping(path = "/api/v1/meetings", produces = MediaType.APPLICATION_JSON_VALUE)
public class MeetingsController {

    private final MeetingService meetingService;
    private final SummaryService summaryService;
    private final AudioAssetRepository audioAssetRepository;
    private final AiExtractionService aiExtractionService;

    public MeetingsController(MeetingService meetingService, SummaryService summaryService,
                              AudioAssetRepository audioAssetRepository,
                              AiExtractionService aiExtractionService) {
        this.meetingService = meetingService;
        this.summaryService = summaryService;
        this.audioAssetRepository = audioAssetRepository;
        this.aiExtractionService = aiExtractionService;
    }

    @GetMapping
    @Operation(summary = "List all meetings", description = "Returns all meetings ordered by creation date (newest first)")
    @ApiResponse(responseCode = "200", description = "Meetings retrieved")
    public List<ListMeetingResponse> listMeetings() {
        return meetingService.listMeetingsEnriched().stream()
                .map(m -> new ListMeetingResponse(m.id(), m.status(), m.title(), m.createdAt(), m.updatedAt(),
                        m.durationSec(), m.minutes(), m.meetingTypeId(), m.meetingTypeName()))
                .toList();
    }

    @PostMapping
    @Operation(summary = "Create a meeting shell", description = "Initialises a meeting before audio upload")
    @ApiResponse(responseCode = "201", description = "Meeting created", content = @Content(schema = @Schema(implementation = CreateMeetingResponse.class)))
    @ResponseStatus(HttpStatus.CREATED)
    public CreateMeetingResponse createMeeting() {
        Meeting meeting = meetingService.createMeeting();
        return new CreateMeetingResponse(meeting.id(), meeting.createdAt());
    }

    @PostMapping(path = "/{meetingId}/audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Upload meeting audio",
            description = "Stores audio for later processing. When AUTO_TRANSCRIBE_ON_UPLOAD is true the same request also runs Whisper and returns the resulting status.")
    @ApiResponse(responseCode = "200", description = "Audio stored", content = @Content(schema = @Schema(implementation = UploadAudioResponse.class)))
    public UploadAudioResponse uploadAudio(@PathVariable UUID meetingId, @RequestPart("file") MultipartFile file) {
        AudioUploadResult result = meetingService.uploadAudio(meetingId, file);
        return new UploadAudioResponse(result.meetingId(), result.assetId(), result.status());
    }

    @PostMapping(path = "/{meetingId}/transcribe")
    @Operation(
            summary = "Transcribe stored meeting audio",
            description = "Runs transcription against the latest uploaded audio asset. Supports multiple providers: remote_openai (cloud), server_local (VPS whisper.cpp), desktop_local (Mac queue).")
    @ApiResponse(responseCode = "200", description = "Transcription complete or queued", content = @Content(schema = @Schema(implementation = TranscribeResponse.class)))
    public TranscribeResponse transcribe(
            @PathVariable UUID meetingId,
            @RequestBody(required = false) TranscribeRequest request) {
        
        if (request == null) {
            MeetingStatus status = meetingService.transcribeMeeting(meetingId);
            return new TranscribeResponse(meetingId, status);
        }

        TranscriptionProvider provider = TranscriptionProvider.fromValue(request.providerOrDefault());
        WhisperModel model = WhisperModel.fromValue(request.modelOrDefault());
        TranscriptionOptions options = new TranscriptionOptions(
                provider,
                model,
                request.enableDiarizationOrDefault()
        );

        MeetingStatus status = meetingService.transcribeMeeting(meetingId, options);
        return new TranscribeResponse(meetingId, status);
    }

    @GetMapping("/{meetingId}")
    @Operation(summary = "Fetch meeting details", description = "Returns status, transcript, and cumulative costs")
    @ApiResponse(responseCode = "200", description = "Meeting retrieved", content = @Content(schema = @Schema(implementation = MeetingDetailsResponse.class)))
    public MeetingDetailsResponse getMeeting(@PathVariable UUID meetingId) {
        MeetingDetails details = meetingService.getMeeting(meetingId);
        MeetingCostBreakdown cost = details.cost();
        MeetingDetailsResponse.Transcript transcript = details.transcript() == null ? null
                : new MeetingDetailsResponse.Transcript(details.transcript().language(), details.transcript().text());
        MeetingDetailsResponse.Summary summary = details.summary() == null ? null
                : new MeetingDetailsResponse.Summary(details.summary().textMd());
        MeetingDetailsResponse.Cost costResponse = mapCost(cost);
        Integer durationSec = details.durationSec();
        Integer minutes = durationSec != null ? durationSec / 60 : null;
        return new MeetingDetailsResponse(details.id(), details.status(), details.createdAt(), details.title(), durationSec, minutes, transcript, summary, costResponse);
    }

    private MeetingDetailsResponse.Cost mapCost(MeetingCostBreakdown cost) {
        MeetingCostBreakdown.WhisperCost whisper = cost.whisper();
        MeetingDetailsResponse.Whisper whisperResponse = new MeetingDetailsResponse.Whisper(
                whisper.minutes(), whisper.usd(), whisper.brl());

        MeetingDetailsResponse.Gpt gptResponse = null;
        if (cost.gpt() != null) {
            gptResponse = new MeetingDetailsResponse.Gpt(
                    cost.gpt().promptTokens(),
                    cost.gpt().completionTokens(),
                    cost.gpt().usd(),
                    cost.gpt().brl());
        }

        MeetingDetailsResponse.Total totalResponse = new MeetingDetailsResponse.Total(
                cost.total().usd(), cost.total().brl());
        return new MeetingDetailsResponse.Cost(whisperResponse, gptResponse, totalResponse);
    }

    @PostMapping("/{meetingId}/summarize")
    @Operation(
            summary = "Generate meeting summary",
            description = "Uses GPT to generate a summary from the meeting transcript. Optionally specify a template ID.")
    @ApiResponse(responseCode = "200", description = "Summary generated", content = @Content(schema = @Schema(implementation = SummarizeResponse.class)))
    public SummarizeResponse summarize(
            @PathVariable UUID meetingId,
            @RequestBody(required = false) SummarizeRequest request) {
        Summary summary;
        if (request != null && (request.systemPromptOverride() != null || request.userPromptOverride() != null || Boolean.TRUE.equals(request.saveAsTemplate()))) {
            summary = summaryService.generateSummary(
                    meetingId, request.templateId(),
                    request.systemPromptOverride(), request.userPromptOverride(),
                    Boolean.TRUE.equals(request.saveAsTemplate()), request.newTemplateName());
        } else {
            UUID templateId = request != null ? request.templateId() : null;
            summary = summaryService.generateSummary(meetingId, templateId);
        }
        return new SummarizeResponse(summary.id(), summary.meetingId(), summary.textMd(),
                summary.templateId(), summary.model(), summary.tokensUsed());
    }

    @GetMapping("/{meetingId}/summary")
    @Operation(
            summary = "Get meeting summary (first/oldest)",
            description = "Returns the first summary for a meeting if available. Use GET /summaries for all.")
    @ApiResponse(responseCode = "200", description = "Summary found")
    @ApiResponse(responseCode = "404", description = "No summary exists")
    public SummarizeResponse getSummary(@PathVariable UUID meetingId) {
        Summary summary = summaryService.getSummary(meetingId)
                .orElseThrow(() -> new com.decisiondesk.backend.web.ApiException(
                        HttpStatus.NOT_FOUND, "NO_SUMMARY", "Meeting has no summary"));
        return new SummarizeResponse(summary.id(), summary.meetingId(), summary.textMd(),
                summary.templateId(), summary.model(), summary.tokensUsed());
    }

    @GetMapping("/{meetingId}/summaries")
    @Operation(
            summary = "Get all meeting summaries",
            description = "Returns all summaries for a meeting (one per template).")
    @ApiResponse(responseCode = "200", description = "Summaries retrieved")
    public List<SummarizeResponse> getAllSummaries(@PathVariable UUID meetingId) {
        return summaryService.getAllSummaries(meetingId).stream()
                .map(s -> new SummarizeResponse(s.id(), s.meetingId(), s.textMd(),
                        s.templateId(), s.model(), s.tokensUsed()))
                .toList();
    }

    @PostMapping("/{meetingId}/summarize-all")
    @Operation(
            summary = "Generate all summaries from meeting type",
            description = "Generates summaries for all templates configured in the meeting's type.")
    @ApiResponse(responseCode = "200", description = "Summaries generated")
    public List<SummarizeResponse> summarizeAll(@PathVariable UUID meetingId) {
        return summaryService.generateAllForMeetingType(meetingId).stream()
                .map(s -> new SummarizeResponse(s.id(), s.meetingId(), s.textMd(),
                        s.templateId(), s.model(), s.tokensUsed()))
                .toList();
    }

    @DeleteMapping("/{meetingId}/summaries/{summaryId}")
    @Operation(summary = "Delete a specific summary", description = "Deletes one summary by ID")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSummary(@PathVariable UUID meetingId, @PathVariable UUID summaryId) {
        summaryService.deleteSummary(summaryId);
    }

    @PostMapping("/{meetingId}/extract")
    @Operation(summary = "Extract structured data from transcript",
               description = "Uses AI to extract action items, decisions, deadlines from the transcript")
    @ApiResponse(responseCode = "200", description = "Extraction completed")
    public AiExtractionService.ExtractionResult extractFromTranscript(
            @PathVariable UUID meetingId,
            @RequestBody(required = false) ExtractionRequest request) {
        Map<String, Object> config = request != null && request.config() != null
                ? request.config()
                : Map.of("action_items", true, "decisions", true, "deadlines", true);
        String provider = request != null ? request.provider() : null;
        String model = request != null ? request.model() : null;
        return aiExtractionService.extract(meetingId, config, provider, model);
    }

    @PutMapping("/{meetingId}")
    @Operation(summary = "Update meeting metadata", description = "Updates title, folder, type, and/or tags")
    @ApiResponse(responseCode = "200", description = "Meeting updated")
    public ListMeetingResponse updateMeeting(
            @PathVariable UUID meetingId,
            @RequestBody UpdateMeetingRequest request) {
        Meeting updated = meetingService.updateMeeting(
                meetingId, request.title(), request.folderId(), request.meetingTypeId(), request.tags());
        return new ListMeetingResponse(updated.id(), updated.status(), updated.title(), updated.createdAt(), updated.updatedAt(),
                null, null, updated.meetingTypeId(), null);
    }

    @DeleteMapping("/{meetingId}")
    @Operation(summary = "Delete a meeting", description = "Soft-deletes a meeting")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMeeting(@PathVariable UUID meetingId) {
        meetingService.deleteMeeting(meetingId);
    }

    @GetMapping("/{meetingId}/audio")
    @Operation(summary = "Stream meeting audio", description = "Returns the audio file for playback")
    @ApiResponse(responseCode = "200", description = "Audio file")
    @ApiResponse(responseCode = "404", description = "No audio found for this meeting")
    public ResponseEntity<Resource> streamAudio(@PathVariable UUID meetingId) {
        AudioAsset asset = audioAssetRepository.findLatestByMeetingId(meetingId)
                .orElseThrow(() -> new com.decisiondesk.backend.web.ApiException(
                        HttpStatus.NOT_FOUND, "AUDIO_NOT_FOUND", "No audio for meeting " + meetingId));

        Path audioPath = Path.of(asset.path());
        Resource resource = new FileSystemResource(audioPath);
        if (!resource.exists()) {
            throw new com.decisiondesk.backend.web.ApiException(
                    HttpStatus.NOT_FOUND, "AUDIO_FILE_MISSING", "Audio file not found on disk");
        }

        String contentType = switch (asset.codec()) {
            case "mp3" -> "audio/mpeg";
            case "m4a", "aac" -> "audio/mp4";
            case "wav" -> "audio/wav";
            case "webm" -> "audio/webm";
            case "ogg", "opus" -> "audio/ogg";
            default -> "application/octet-stream";
        };

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .body(resource);
    }

    @PostMapping("/{meetingId}/reset-status")
    @Operation(summary = "Reset stuck meeting status", description = "Resets a PROCESSING or ERROR meeting back to NEW")
    @ApiResponse(responseCode = "200", description = "Status reset")
    public ListMeetingResponse resetStatus(@PathVariable UUID meetingId) {
        Meeting meeting = meetingService.resetStatus(meetingId);
        return new ListMeetingResponse(meeting.id(), meeting.status(), meeting.title(), meeting.createdAt(), meeting.updatedAt(),
                null, null, meeting.meetingTypeId(), null);
    }

    public record UpdateMeetingRequest(
            String title,
            UUID folderId,
            UUID meetingTypeId,
            Map<String, String> tags
    ) {}

    public record ListMeetingResponse(
            UUID id,
            MeetingStatus status,
            String title,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            Integer durationSec,
            Integer minutes,
            UUID meetingTypeId,
            String meetingTypeName
    ) {}

    // Request/Response records for summarization
    public record SummarizeRequest(
            UUID templateId,
            String systemPromptOverride,
            String userPromptOverride,
            Boolean saveAsTemplate,
            String newTemplateName
    ) {}
    
    public record SummarizeResponse(
            UUID id,
            UUID meetingId,
            String textMd,
            UUID templateId,
            String model,
            Integer tokensUsed
    ) {}

    public record ExtractionRequest(
            Map<String, Object> config,
            String provider,
            String model
    ) {}
}
