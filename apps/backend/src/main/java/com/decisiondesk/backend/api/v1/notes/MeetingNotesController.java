package com.decisiondesk.backend.api.v1.notes;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.persistence.MeetingRepository;
import com.decisiondesk.backend.notes.model.NotesBlock;
import com.decisiondesk.backend.notes.service.MeetingNotesService;
import com.decisiondesk.backend.notes.service.MeetingNotesService.MeetingContext;
import com.decisiondesk.backend.notes.service.NotesBlockParser;
import com.decisiondesk.backend.notes.service.NotesBlockParser.ActionItem;
import com.decisiondesk.backend.notes.service.TranscriptImportService;
import com.decisiondesk.backend.notes.service.TranscriptImportService.ImportResult;
import com.decisiondesk.backend.web.ApiException;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * REST controller for meeting notes operations.
 */
@RestController
@RequestMapping("/api/v1/meetings/{meetingId}/notes")
@Tag(name = "Meeting Notes", description = "Operations for managing meeting notes")
public class MeetingNotesController {

    private final MeetingNotesService notesService;
    private final TranscriptImportService importService;
    private final MeetingRepository meetingRepository;
    private final NotesBlockParser blockParser;

    public MeetingNotesController(
            MeetingNotesService notesService,
            TranscriptImportService importService,
            MeetingRepository meetingRepository,
            NotesBlockParser blockParser) {
        this.notesService = notesService;
        this.importService = importService;
        this.meetingRepository = meetingRepository;
        this.blockParser = blockParser;
    }

    // =========================================================================
    // Notes CRUD
    // =========================================================================

    @Operation(summary = "Get meeting notes")
    @GetMapping
    public ResponseEntity<NotesResponse> getNotes(@PathVariable UUID meetingId) {
        Meeting meeting = getMeetingOrThrow(meetingId);
        
        List<NotesBlock> liveBlocks = blockParser.parseBlocks(meeting.liveNotes());
        List<ActionItem> actionItems = notesService.getActionItems(meetingId);
        List<String> decisions = notesService.getDecisions(meetingId);
        
        return ResponseEntity.ok(new NotesResponse(
                meeting.agenda(),
                meeting.liveNotes(),
                meeting.postNotes(),
                liveBlocks,
                actionItems,
                decisions
        ));
    }

    @Operation(summary = "Update meeting agenda")
    @PatchMapping("/agenda")
    public ResponseEntity<Meeting> updateAgenda(
            @PathVariable UUID meetingId,
            @RequestBody NotesUpdateRequest request) {
        Meeting updated = notesService.updateAgenda(meetingId, request.content());
        return ResponseEntity.ok(updated);
    }

    @Operation(summary = "Update live notes (during meeting)")
    @PatchMapping("/live")
    public ResponseEntity<Meeting> updateLiveNotes(
            @PathVariable UUID meetingId,
            @RequestBody NotesUpdateRequest request) {
        Meeting updated = notesService.updateLiveNotes(meetingId, request.content(), true);
        return ResponseEntity.ok(updated);
    }

    @Operation(summary = "Update post-meeting notes")
    @PatchMapping("/post")
    public ResponseEntity<Meeting> updatePostNotes(
            @PathVariable UUID meetingId,
            @RequestBody NotesUpdateRequest request) {
        Meeting updated = notesService.updatePostNotes(meetingId, request.content());
        return ResponseEntity.ok(updated);
    }

    // =========================================================================
    // Action Items & Decisions
    // =========================================================================

    @Operation(summary = "Get action items from live notes")
    @GetMapping("/action-items")
    public ResponseEntity<List<ActionItem>> getActionItems(@PathVariable UUID meetingId) {
        List<ActionItem> items = notesService.getActionItems(meetingId);
        return ResponseEntity.ok(items);
    }

    @Operation(summary = "Get decisions from live notes")
    @GetMapping("/decisions")
    public ResponseEntity<List<String>> getDecisions(@PathVariable UUID meetingId) {
        List<String> decisions = notesService.getDecisions(meetingId);
        return ResponseEntity.ok(decisions);
    }

    // =========================================================================
    // Continuity
    // =========================================================================

    @Operation(summary = "Link to previous meeting")
    @PostMapping("/link-previous")
    public ResponseEntity<Meeting> linkToPreviousMeeting(
            @PathVariable UUID meetingId,
            @RequestBody LinkPreviousRequest request) {
        Meeting updated = notesService.linkToPreviousMeeting(meetingId, request.previousMeetingId());
        return ResponseEntity.ok(updated);
    }

    @Operation(summary = "Get previous meeting context")
    @GetMapping("/previous-context")
    public ResponseEntity<MeetingContext> getPreviousContext(@PathVariable UUID meetingId) {
        MeetingContext context = notesService.getPreviousMeetingContext(meetingId);
        return ResponseEntity.ok(context);
    }

    @Operation(summary = "Get formatted context for GPT")
    @GetMapping("/gpt-context")
    public ResponseEntity<String> getGptContext(@PathVariable UUID meetingId) {
        String context = notesService.buildContextForGpt(meetingId);
        return ResponseEntity.ok(context);
    }

    // =========================================================================
    // Import
    // =========================================================================

    @Operation(summary = "Import transcript from file (Teams, Zoom, etc.)")
    @PostMapping("/import")
    public ResponseEntity<ImportResult> importTranscript(
            @PathVariable UUID meetingId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "source", required = false) String source) {
        ImportResult result = importService.importIntoMeeting(meetingId, file, source);
        return ResponseEntity.ok(result);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private Meeting getMeetingOrThrow(UUID meetingId) {
        return meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, 
                        "MEETING_NOT_FOUND", "Meeting not found: " + meetingId));
    }

    // =========================================================================
    // DTOs
    // =========================================================================

    public record NotesResponse(
            String agenda,
            String liveNotes,
            String postNotes,
            List<NotesBlock> parsedBlocks,
            List<ActionItem> actionItems,
            List<String> decisions
    ) {}

    public record NotesUpdateRequest(String content) {}

    public record LinkPreviousRequest(UUID previousMeetingId) {}
}
