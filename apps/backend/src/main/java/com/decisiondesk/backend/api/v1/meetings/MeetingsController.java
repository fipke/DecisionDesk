package com.decisiondesk.backend.api.v1.meetings;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.decisiondesk.backend.meetings.MeetingService;
import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.TranscriptionOptions;
import com.decisiondesk.backend.meetings.TranscriptionProvider;
import com.decisiondesk.backend.meetings.WhisperModel;
import com.decisiondesk.backend.meetings.model.AudioUploadResult;
import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.model.MeetingCostBreakdown;
import com.decisiondesk.backend.meetings.model.MeetingDetails;
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

    public MeetingsController(MeetingService meetingService, SummaryService summaryService) {
        this.meetingService = meetingService;
        this.summaryService = summaryService;
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
        return new MeetingDetailsResponse(details.id(), details.status(), details.createdAt(), transcript, summary, costResponse);
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
        UUID templateId = request != null ? request.templateId() : null;
        Summary summary = summaryService.generateSummary(meetingId, templateId);
        return new SummarizeResponse(summary.id(), summary.meetingId(), summary.textMd(), 
                summary.templateId(), summary.model(), summary.tokensUsed());
    }

    @GetMapping("/{meetingId}/summary")
    @Operation(
            summary = "Get meeting summary",
            description = "Returns the existing summary for a meeting if available.")
    @ApiResponse(responseCode = "200", description = "Summary found")
    @ApiResponse(responseCode = "404", description = "No summary exists")
    public SummarizeResponse getSummary(@PathVariable UUID meetingId) {
        Summary summary = summaryService.getSummary(meetingId)
                .orElseThrow(() -> new com.decisiondesk.backend.web.ApiException(
                        HttpStatus.NOT_FOUND, "NO_SUMMARY", "Meeting has no summary"));
        return new SummarizeResponse(summary.id(), summary.meetingId(), summary.textMd(),
                summary.templateId(), summary.model(), summary.tokensUsed());
    }

    // Request/Response records for summarization
    public record SummarizeRequest(UUID templateId) {}
    
    public record SummarizeResponse(
            UUID id,
            UUID meetingId,
            String textMd,
            UUID templateId,
            String model,
            Integer tokensUsed
    ) {}
}
