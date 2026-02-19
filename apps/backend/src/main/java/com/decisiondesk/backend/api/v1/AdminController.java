package com.decisiondesk.backend.api.v1;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.meetings.DurationBackfillService;
import com.decisiondesk.backend.meetings.DurationBackfillService.BackfillResult;

import io.swagger.v3.oas.annotations.Operation;

/**
 * Admin endpoints for maintenance operations.
 */
@RestController
@RequestMapping(path = "/api/v1/admin", produces = MediaType.APPLICATION_JSON_VALUE)
public class AdminController {

    private final DurationBackfillService durationBackfillService;

    public AdminController(DurationBackfillService durationBackfillService) {
        this.durationBackfillService = durationBackfillService;
    }

    @PostMapping("/backfill-durations")
    @Operation(
            summary = "Backfill audio durations",
            description = "Re-extracts duration_sec (via ffprobe) for all audio assets where it is NULL")
    public BackfillResponse backfillDurations() {
        BackfillResult result = durationBackfillService.backfill();
        return new BackfillResponse(result.total(), result.updated(), result.failed());
    }

    public record BackfillResponse(int total, int updated, int failed) {}
}
