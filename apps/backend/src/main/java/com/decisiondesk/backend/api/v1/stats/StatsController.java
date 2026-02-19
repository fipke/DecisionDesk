package com.decisiondesk.backend.api.v1.stats;

import java.time.LocalDate;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Dashboard statistics endpoints.
 */
@RestController
@RequestMapping(path = "/api/v1/stats", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Stats", description = "Dashboard statistics")
public class StatsController {

    private final JdbcClient jdbcClient;

    public StatsController(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @GetMapping
    @Operation(summary = "Get dashboard stats", description = "Returns aggregate meeting statistics")
    public StatsResponse getStats() {
        long totalMeetings = jdbcClient.sql("SELECT COUNT(*) FROM meetings")
                .query(Long.class).single();

        Long totalMinutes = jdbcClient.sql(
                        "SELECT COALESCE(SUM(COALESCE(duration_sec, 0)), 0) / 60 FROM meetings")
                .query(Long.class).single();

        long pendingActions = jdbcClient.sql(
                        "SELECT COUNT(*) FROM meetings WHERE status = 'PROCESSING'")
                .query(Long.class).single();

        long thisWeekCount = jdbcClient.sql("""
                        SELECT COUNT(*) FROM meetings
                        WHERE created_at >= date_trunc('week', CURRENT_DATE)
                        """)
                .query(Long.class).single();

        return new StatsResponse(totalMeetings, totalMinutes != null ? totalMinutes : 0,
                pendingActions, thisWeekCount);
    }

    @GetMapping("/calendar")
    @Operation(summary = "Get calendar data", description = "Returns meeting counts per day for a date range")
    public List<CalendarDay> getCalendar(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to) {
        return jdbcClient.sql("""
                        SELECT DATE(created_at) AS day, COUNT(*) AS count
                        FROM meetings
                        WHERE DATE(created_at) BETWEEN :from AND :to
                        GROUP BY DATE(created_at)
                        ORDER BY day
                        """)
                .param("from", from)
                .param("to", to)
                .query((rs, rowNum) -> new CalendarDay(
                        rs.getDate("day").toLocalDate(),
                        rs.getInt("count")))
                .list();
    }

    public record StatsResponse(long totalMeetings, long totalMinutesRecorded,
                                 long pendingProcessing, long thisWeekCount) {}
    public record CalendarDay(LocalDate day, int count) {}
}
