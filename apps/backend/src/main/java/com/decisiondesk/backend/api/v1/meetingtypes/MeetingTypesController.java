package com.decisiondesk.backend.api.v1.meetingtypes;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.meetingtypes.MeetingTypeService;
import com.decisiondesk.backend.meetingtypes.model.MeetingType;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

/**
 * REST controller for meeting type operations (PR07).
 */
@RestController
@RequestMapping(path = "/api/v1/meeting-types", produces = MediaType.APPLICATION_JSON_VALUE)
public class MeetingTypesController {

    private final MeetingTypeService meetingTypeService;

    public MeetingTypesController(MeetingTypeService meetingTypeService) {
        this.meetingTypeService = meetingTypeService;
    }

    @PostMapping
    @Operation(summary = "Create a meeting type", description = "Creates a new meeting type for categorizing meetings")
    @ApiResponse(responseCode = "201", description = "Meeting type created", content = @Content(schema = @Schema(implementation = MeetingTypeResponse.class)))
    @ResponseStatus(HttpStatus.CREATED)
    public MeetingTypeResponse createMeetingType(@RequestBody MeetingTypeRequest request) {
        MeetingType meetingType = meetingTypeService.createMeetingType(
            request.nameOrDefault(),
            request.description(),
            request.requiredTags(),
            request.defaultWhisperModel()
        );
        return toResponse(meetingType);
    }

    @GetMapping
    @Operation(summary = "List all meeting types", description = "Returns all meeting types")
    @ApiResponse(responseCode = "200", description = "Meeting types retrieved")
    public List<MeetingTypeResponse> listMeetingTypes() {
        return meetingTypeService.getAllMeetingTypes().stream()
            .map(this::toResponse)
            .toList();
    }

    @GetMapping("/{typeId}")
    @Operation(summary = "Get meeting type details", description = "Returns details of a specific meeting type")
    @ApiResponse(responseCode = "200", description = "Meeting type retrieved", content = @Content(schema = @Schema(implementation = MeetingTypeResponse.class)))
    public MeetingTypeResponse getMeetingType(@PathVariable UUID typeId) {
        MeetingType meetingType = meetingTypeService.getMeetingType(typeId);
        return toResponse(meetingType);
    }

    @PutMapping("/{typeId}")
    @Operation(summary = "Update a meeting type", description = "Updates meeting type name, description, or tags")
    @ApiResponse(responseCode = "200", description = "Meeting type updated", content = @Content(schema = @Schema(implementation = MeetingTypeResponse.class)))
    public MeetingTypeResponse updateMeetingType(@PathVariable UUID typeId, @RequestBody MeetingTypeRequest request) {
        MeetingType meetingType = meetingTypeService.updateMeetingType(
            typeId,
            request.name(),
            request.description(),
            request.requiredTags(),
            request.defaultWhisperModel()
        );
        return toResponse(meetingType);
    }

    @DeleteMapping("/{typeId}")
    @Operation(summary = "Delete a meeting type", description = "Deletes a meeting type")
    @ApiResponse(responseCode = "204", description = "Meeting type deleted")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMeetingType(@PathVariable UUID typeId) {
        meetingTypeService.deleteMeetingType(typeId);
    }

    private MeetingTypeResponse toResponse(MeetingType meetingType) {
        return new MeetingTypeResponse(
            meetingType.id(),
            meetingType.name(),
            meetingType.description(),
            meetingType.requiredTags(),
            meetingType.defaultWhisperModel(),
            meetingType.createdAt()
        );
    }
}
