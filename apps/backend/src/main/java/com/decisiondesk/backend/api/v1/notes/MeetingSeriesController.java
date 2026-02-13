package com.decisiondesk.backend.api.v1.notes;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.notes.model.MeetingSeries;
import com.decisiondesk.backend.notes.persistence.MeetingSeriesRepository;
import com.decisiondesk.backend.notes.service.MeetingNotesService;
import com.decisiondesk.backend.web.ApiException;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * REST controller for meeting series operations.
 */
@RestController
@RequestMapping("/api/v1/meeting-series")
@Tag(name = "Meeting Series", description = "Operations for managing recurring meeting series")
public class MeetingSeriesController {

    private final MeetingNotesService notesService;
    private final MeetingSeriesRepository seriesRepository;

    public MeetingSeriesController(
            MeetingNotesService notesService,
            MeetingSeriesRepository seriesRepository) {
        this.notesService = notesService;
        this.seriesRepository = seriesRepository;
    }

    // =========================================================================
    // CRUD
    // =========================================================================

    @Operation(summary = "List all meeting series")
    @GetMapping
    public ResponseEntity<List<MeetingSeries>> listSeries() {
        List<MeetingSeries> series = seriesRepository.findAll();
        return ResponseEntity.ok(series);
    }

    @Operation(summary = "Get a meeting series by ID")
    @GetMapping("/{seriesId}")
    public ResponseEntity<MeetingSeries> getSeries(@PathVariable UUID seriesId) {
        MeetingSeries series = getSeriesOrThrow(seriesId);
        return ResponseEntity.ok(series);
    }

    @Operation(summary = "Create a new meeting series")
    @PostMapping
    public ResponseEntity<MeetingSeries> createSeries(@RequestBody CreateSeriesRequest request) {
        MeetingSeries series = notesService.createSeries(
                request.name(),
                request.description()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(series);
    }

    @Operation(summary = "Update a meeting series")
    @PatchMapping("/{seriesId}")
    public ResponseEntity<MeetingSeries> updateSeries(
            @PathVariable UUID seriesId,
            @RequestBody UpdateSeriesRequest request) {
        MeetingSeries existing = getSeriesOrThrow(seriesId);
        
        MeetingSeries updated = new MeetingSeries(
                seriesId,
                request.name() != null ? request.name() : existing.name(),
                request.description() != null ? request.description() : existing.description(),
                request.recurrenceRule() != null ? request.recurrenceRule() : existing.recurrenceRule(),
                existing.defaultFolderId(),
                existing.defaultTypeId(),
                existing.defaultTags(),
                existing.createdAt(),
                java.time.OffsetDateTime.now()
        );
        
        seriesRepository.update(updated);
        return ResponseEntity.ok(seriesRepository.findById(seriesId).orElseThrow());
    }

    @Operation(summary = "Delete a meeting series")
    @DeleteMapping("/{seriesId}")
    public ResponseEntity<Void> deleteSeries(@PathVariable UUID seriesId) {
        getSeriesOrThrow(seriesId); // Validate exists
        seriesRepository.delete(seriesId);
        return ResponseEntity.noContent().build();
    }

    // =========================================================================
    // Series Meetings
    // =========================================================================

    @Operation(summary = "Get all meetings in a series")
    @GetMapping("/{seriesId}/meetings")
    public ResponseEntity<List<Meeting>> getSeriesMeetings(@PathVariable UUID seriesId) {
        getSeriesOrThrow(seriesId); // Validate exists
        List<Meeting> meetings = notesService.getSeriesMeetings(seriesId);
        return ResponseEntity.ok(meetings);
    }

    @Operation(summary = "Add a meeting to a series")
    @PostMapping("/{seriesId}/meetings")
    public ResponseEntity<Meeting> addMeetingToSeries(
            @PathVariable UUID seriesId,
            @RequestBody AddMeetingRequest request) {
        getSeriesOrThrow(seriesId); // Validate exists
        Meeting meeting = notesService.addToSeries(request.meetingId(), seriesId);
        return ResponseEntity.ok(meeting);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private MeetingSeries getSeriesOrThrow(UUID seriesId) {
        return seriesRepository.findById(seriesId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "SERIES_NOT_FOUND", "Meeting series not found: " + seriesId));
    }

    // =========================================================================
    // DTOs
    // =========================================================================

    public record CreateSeriesRequest(
            String name,
            String description,
            String recurrenceRule
    ) {}

    public record UpdateSeriesRequest(
            String name,
            String description,
            String recurrenceRule
    ) {}

    public record AddMeetingRequest(UUID meetingId) {}
}
