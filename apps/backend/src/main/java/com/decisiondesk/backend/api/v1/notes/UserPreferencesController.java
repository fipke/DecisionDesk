package com.decisiondesk.backend.api.v1.notes;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.notes.model.UserPreference;
import com.decisiondesk.backend.notes.service.MeetingNotesService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * REST controller for user preferences.
 */
@RestController
@RequestMapping("/api/v1/preferences")
@Tag(name = "User Preferences", description = "Operations for managing user preferences")
public class UserPreferencesController {

    private final MeetingNotesService notesService;

    public UserPreferencesController(MeetingNotesService notesService) {
        this.notesService = notesService;
    }

    @Operation(summary = "Get user preferences")
    @GetMapping("/{userId}")
    public ResponseEntity<UserPreference> getPreferences(@PathVariable String userId) {
        UserPreference prefs = notesService.getOrCreatePreferences(userId);
        return ResponseEntity.ok(prefs);
    }

    @Operation(summary = "Update user preferences")
    @PatchMapping("/{userId}")
    public ResponseEntity<UserPreference> updatePreferences(
            @PathVariable String userId,
            @RequestBody UpdatePreferencesRequest request) {
        UserPreference updated = notesService.updatePreferences(
                userId,
                request.defaultLanguage(),
                request.notesTemplate()
        );
        return ResponseEntity.ok(updated);
    }

    public record UpdatePreferencesRequest(
            String defaultLanguage,
            String notesTemplate
    ) {}
}
