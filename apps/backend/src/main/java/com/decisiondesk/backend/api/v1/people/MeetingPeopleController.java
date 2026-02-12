package com.decisiondesk.backend.api.v1.people;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.people.PersonService;
import com.decisiondesk.backend.people.model.PersonRole;

/**
 * REST controller for meeting-person associations.
 */
@RestController
@RequestMapping("/api/v1/meetings/{meetingId}/people")
public class MeetingPeopleController {

    private final PersonService personService;

    public MeetingPeopleController(PersonService personService) {
        this.personService = personService;
    }

    /**
     * Get all people associated with a meeting.
     * GET /api/v1/meetings/{meetingId}/people
     */
    @GetMapping
    public List<PersonWithRoleResponse> getMeetingPeople(@PathVariable UUID meetingId) {
        return personService.getMeetingPeople(meetingId).stream()
            .map(PersonWithRoleResponse::from)
            .toList();
    }

    /**
     * Get participants of a meeting.
     * GET /api/v1/meetings/{meetingId}/people?role=participant
     */
    @GetMapping(params = "role=participant")
    public List<PersonResponse> getParticipants(@PathVariable UUID meetingId) {
        return personService.getParticipants(meetingId).stream()
            .map(PersonResponse::from)
            .toList();
    }

    /**
     * Get mentioned people in a meeting.
     * GET /api/v1/meetings/{meetingId}/people?role=mentioned
     */
    @GetMapping(params = "role=mentioned")
    public List<PersonResponse> getMentioned(@PathVariable UUID meetingId) {
        return personService.getMentioned(meetingId).stream()
            .map(PersonResponse::from)
            .toList();
    }

    /**
     * Add a person to a meeting.
     * POST /api/v1/meetings/{meetingId}/people
     */
    @PostMapping
    public ResponseEntity<Void> addPerson(
        @PathVariable UUID meetingId,
        @RequestBody AddPersonToMeetingRequest request
    ) {
        PersonRole role = PersonRole.fromValue(request.role());
        personService.addPersonToMeeting(meetingId, request.personId(), role);
        return ResponseEntity.ok().build();
    }

    /**
     * Remove a person from a meeting.
     * DELETE /api/v1/meetings/{meetingId}/people/{personId}?role=participant
     */
    @DeleteMapping("/{personId}")
    public ResponseEntity<Void> removePerson(
        @PathVariable UUID meetingId,
        @PathVariable UUID personId,
        @RequestParam String role
    ) {
        PersonRole personRole = PersonRole.fromValue(role);
        if (personService.removePersonFromMeeting(meetingId, personId, personRole)) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
