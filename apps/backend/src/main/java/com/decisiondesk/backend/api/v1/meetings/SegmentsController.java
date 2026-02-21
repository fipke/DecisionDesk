package com.decisiondesk.backend.api.v1.meetings;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

import com.decisiondesk.backend.meetings.model.MeetingSpeaker;
import com.decisiondesk.backend.meetings.model.TranscriptSegment;
import com.decisiondesk.backend.meetings.persistence.MeetingSpeakerRepository;
import com.decisiondesk.backend.meetings.persistence.TranscriptSegmentRepository;

import io.swagger.v3.oas.annotations.Operation;

/**
 * REST controller for transcript segments and meeting speakers.
 */
@RestController
@RequestMapping(path = "/api/v1/meetings/{meetingId}", produces = MediaType.APPLICATION_JSON_VALUE)
public class SegmentsController {

    private final TranscriptSegmentRepository segmentRepo;
    private final MeetingSpeakerRepository speakerRepo;

    public SegmentsController(TranscriptSegmentRepository segmentRepo, MeetingSpeakerRepository speakerRepo) {
        this.segmentRepo = segmentRepo;
        this.speakerRepo = speakerRepo;
    }

    // ─── Segments ─────────────────────────────────────────────

    /**
     * GET /api/v1/meetings/{meetingId}/segments
     */
    @GetMapping("/segments")
    @Operation(summary = "List transcript segments for a meeting")
    public SegmentsWithSpeakersResponse getSegments(@PathVariable UUID meetingId) {
        List<TranscriptSegment> segments = segmentRepo.findByMeetingId(meetingId);
        List<MeetingSpeaker> speakers = speakerRepo.findByMeetingId(meetingId);
        return new SegmentsWithSpeakersResponse(
            segments.stream().map(SegmentResponse::from).toList(),
            speakers.stream().map(SpeakerResponse::from).toList()
        );
    }

    /**
     * POST /api/v1/meetings/{meetingId}/segments — bulk insert segments + speakers.
     */
    @PostMapping("/segments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Bulk insert transcript segments with speaker data")
    public SegmentsWithSpeakersResponse createSegments(
            @PathVariable UUID meetingId,
            @RequestBody BulkSegmentsRequest request) {

        // Clear existing data
        segmentRepo.deleteByMeetingId(meetingId);
        speakerRepo.deleteByMeetingId(meetingId);

        // Create speakers from unique labels
        Set<String> labels = new HashSet<>();
        for (BulkSegmentsRequest.SegmentInput seg : request.segments()) {
            if (seg.speakerLabel() != null) {
                labels.add(seg.speakerLabel());
            }
        }

        Map<String, MeetingSpeaker> speakerMap = new HashMap<>();
        int colorIndex = 0;
        for (String label : labels) {
            MeetingSpeaker speaker = speakerRepo.create(MeetingSpeaker.create(meetingId, label, colorIndex++));
            speakerMap.put(label, speaker);
        }

        // Create segments
        List<TranscriptSegment> segments = new ArrayList<>();
        for (int i = 0; i < request.segments().size(); i++) {
            BulkSegmentsRequest.SegmentInput input = request.segments().get(i);
            TranscriptSegment seg = TranscriptSegment.create(meetingId, i, input.startSec(), input.endSec(), input.text());
            if (input.speakerLabel() != null && speakerMap.containsKey(input.speakerLabel())) {
                MeetingSpeaker speaker = speakerMap.get(input.speakerLabel());
                seg = seg.withSpeaker(input.speakerLabel(), speaker.id());
            }
            segments.add(seg);
        }

        List<TranscriptSegment> inserted = segmentRepo.insertBatch(meetingId, segments);

        // Calculate talk time per speaker
        for (Map.Entry<String, MeetingSpeaker> entry : speakerMap.entrySet()) {
            double talkTime = segments.stream()
                .filter(s -> entry.getKey().equals(s.speakerLabel()))
                .mapToDouble(s -> s.endSec() - s.startSec())
                .sum();
            speakerRepo.update(entry.getValue().withTalkTimeSec(talkTime));
        }

        List<MeetingSpeaker> speakers = speakerRepo.findByMeetingId(meetingId);
        return new SegmentsWithSpeakersResponse(
            inserted.stream().map(SegmentResponse::from).toList(),
            speakers.stream().map(SpeakerResponse::from).toList()
        );
    }

    /**
     * DELETE /api/v1/meetings/{meetingId}/segments — clear all segments and speakers.
     */
    @DeleteMapping("/segments")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete all segments for a meeting")
    public void deleteSegments(@PathVariable UUID meetingId) {
        segmentRepo.deleteByMeetingId(meetingId);
        speakerRepo.deleteByMeetingId(meetingId);
    }

    // ─── Speakers ─────────────────────────────────────────────

    /**
     * GET /api/v1/meetings/{meetingId}/speakers
     */
    @GetMapping("/speakers")
    @Operation(summary = "List speakers for a meeting")
    public List<SpeakerResponse> getSpeakers(@PathVariable UUID meetingId) {
        return speakerRepo.findByMeetingId(meetingId).stream()
            .map(SpeakerResponse::from)
            .toList();
    }

    /**
     * PUT /api/v1/meetings/{meetingId}/speakers/{speakerId} — rename or link speaker to person.
     */
    @PutMapping("/speakers/{speakerId}")
    @Operation(summary = "Update a meeting speaker (rename, link to person)")
    public SpeakerResponse updateSpeaker(
            @PathVariable UUID meetingId,
            @PathVariable UUID speakerId,
            @RequestBody UpdateSpeakerRequest request) {
        MeetingSpeaker existing = speakerRepo.findById(speakerId)
            .orElseThrow(() -> new IllegalArgumentException("Speaker not found: " + speakerId));

        MeetingSpeaker updated = existing;
        if (request.displayName() != null) {
            updated = updated.withDisplayName(request.displayName());
        }
        if (request.personId() != null) {
            updated = updated.withPersonId(request.personId());
        }
        return SpeakerResponse.from(speakerRepo.update(updated));
    }

    /**
     * POST /api/v1/meetings/{meetingId}/speakers/merge — merge two speakers.
     */
    @PostMapping("/speakers/merge")
    @Operation(summary = "Merge two speakers (absorb one into another)")
    public List<SpeakerResponse> mergeSpeakers(
            @PathVariable UUID meetingId,
            @RequestBody MergeSpeakersRequest request) {
        speakerRepo.merge(meetingId, request.keepId(), request.absorbId());
        return speakerRepo.findByMeetingId(meetingId).stream()
            .map(SpeakerResponse::from)
            .toList();
    }

    // ─── DTOs ─────────────────────────────────────────────────

    public record SegmentsWithSpeakersResponse(
        List<SegmentResponse> segments,
        List<SpeakerResponse> speakers
    ) {}

    public record SegmentResponse(
        UUID id,
        int ordinal,
        double startSec,
        double endSec,
        String text,
        String speakerLabel,
        UUID speakerId,
        OffsetDateTime createdAt
    ) {
        static SegmentResponse from(TranscriptSegment s) {
            return new SegmentResponse(s.id(), s.ordinal(), s.startSec(), s.endSec(), s.text(), s.speakerLabel(), s.speakerId(), s.createdAt());
        }
    }

    public record SpeakerResponse(
        UUID id,
        String label,
        String displayName,
        UUID personId,
        int colorIndex,
        double talkTimeSec,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
    ) {
        static SpeakerResponse from(MeetingSpeaker s) {
            return new SpeakerResponse(s.id(), s.label(), s.displayName(), s.personId(), s.colorIndex(), s.talkTimeSec(), s.createdAt(), s.updatedAt());
        }
    }

    public record BulkSegmentsRequest(List<SegmentInput> segments) {
        public record SegmentInput(double startSec, double endSec, String text, String speakerLabel) {}
    }

    public record UpdateSpeakerRequest(String displayName, UUID personId) {}

    public record MergeSpeakersRequest(UUID keepId, UUID absorbId) {}
}
