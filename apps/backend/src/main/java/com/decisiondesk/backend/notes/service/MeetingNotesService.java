package com.decisiondesk.backend.notes.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.persistence.MeetingRepository;
import com.decisiondesk.backend.notes.model.MeetingSeries;
import com.decisiondesk.backend.notes.model.NotesTemplate;
import com.decisiondesk.backend.notes.model.UserPreference;
import com.decisiondesk.backend.notes.persistence.MeetingSeriesRepository;
import com.decisiondesk.backend.notes.persistence.NotesTemplateRepository;
import com.decisiondesk.backend.notes.persistence.UserPreferenceRepository;
import com.decisiondesk.backend.summaries.model.Summary;
import com.decisiondesk.backend.summaries.persistence.SummaryRepository;
import com.decisiondesk.backend.web.ApiException;

/**
 * Service for managing meeting notes, series, and continuity features.
 */
@Service
public class MeetingNotesService {

    private static final Logger log = LoggerFactory.getLogger(MeetingNotesService.class);

    private final MeetingRepository meetingRepository;
    private final MeetingSeriesRepository seriesRepository;
    private final UserPreferenceRepository preferenceRepository;
    private final NotesTemplateRepository templateRepository;
    private final SummaryRepository summaryRepository;
    private final NotesBlockParser blockParser;

    public MeetingNotesService(
            MeetingRepository meetingRepository,
            MeetingSeriesRepository seriesRepository,
            UserPreferenceRepository preferenceRepository,
            NotesTemplateRepository templateRepository,
            @org.springframework.beans.factory.annotation.Qualifier("summariesSummaryRepository") SummaryRepository summaryRepository,
            NotesBlockParser blockParser) {
        this.meetingRepository = meetingRepository;
        this.seriesRepository = seriesRepository;
        this.preferenceRepository = preferenceRepository;
        this.templateRepository = templateRepository;
        this.summaryRepository = summaryRepository;
        this.blockParser = blockParser;
    }

    // =========================================================================
    // Notes Operations
    // =========================================================================

    /**
     * Updates the agenda (pre-meeting notes) for a meeting.
     */
    @Transactional
    public Meeting updateAgenda(UUID meetingId, String agenda) {
        validateMeetingExists(meetingId);
        meetingRepository.updateAgenda(meetingId, agenda);
        log.info("Updated agenda for meeting={}", meetingId);
        return meetingRepository.findById(meetingId).orElseThrow();
    }

    /**
     * Updates the live notes for a meeting.
     * Optionally cleans empty blocks on save.
     */
    @Transactional
    public Meeting updateLiveNotes(UUID meetingId, String liveNotes, boolean cleanEmpty) {
        validateMeetingExists(meetingId);
        String notesToSave = cleanEmpty ? blockParser.cleanEmptyBlocks(liveNotes) : liveNotes;
        meetingRepository.updateLiveNotes(meetingId, notesToSave);
        log.info("Updated live notes for meeting={}", meetingId);
        return meetingRepository.findById(meetingId).orElseThrow();
    }

    /**
     * Updates the post-meeting notes.
     */
    @Transactional
    public Meeting updatePostNotes(UUID meetingId, String postNotes) {
        validateMeetingExists(meetingId);
        meetingRepository.updatePostNotes(meetingId, postNotes);
        log.info("Updated post notes for meeting={}", meetingId);
        return meetingRepository.findById(meetingId).orElseThrow();
    }

    /**
     * Gets the default notes template for a user.
     */
    public String getDefaultNotesTemplate(String userId) {
        // Check user preference first
        Optional<UserPreference> pref = preferenceRepository.findByUserId(userId);
        if (pref.isPresent() && pref.get().notesTemplate() != null) {
            return pref.get().notesTemplate();
        }

        // Get language preference or default
        String language = pref.map(UserPreference::defaultLanguage)
                .orElse(UserPreference.DEFAULT_LANGUAGE);

        // Get default template for language
        return templateRepository.findDefaultByLanguage(language)
                .map(NotesTemplate::template)
                .orElseGet(() -> templateRepository.findDefaultByLanguage("en")
                        .map(NotesTemplate::template)
                        .orElse(""));
    }

    /**
     * Extracts action items from meeting live notes.
     */
    public List<NotesBlockParser.ActionItem> getActionItems(UUID meetingId) {
        Meeting meeting = validateMeetingExists(meetingId);
        return blockParser.extractActionItems(meeting.liveNotes());
    }

    /**
     * Extracts decisions from meeting live notes.
     */
    public List<String> getDecisions(UUID meetingId) {
        Meeting meeting = validateMeetingExists(meetingId);
        return blockParser.extractDecisions(meeting.liveNotes());
    }

    // =========================================================================
    // Continuity Operations
    // =========================================================================

    /**
     * Links a meeting to a previous meeting for continuity.
     */
    @Transactional
    public Meeting linkToPreviousMeeting(UUID meetingId, UUID previousMeetingId) {
        validateMeetingExists(meetingId);
        validateMeetingExists(previousMeetingId);
        meetingRepository.updatePreviousMeeting(meetingId, previousMeetingId);
        log.info("Linked meeting={} to previous={}", meetingId, previousMeetingId);
        return meetingRepository.findById(meetingId).orElseThrow();
    }

    /**
     * Gets context from the previous meeting (summary + open action items).
     */
    public MeetingContext getPreviousMeetingContext(UUID meetingId) {
        Meeting meeting = validateMeetingExists(meetingId);
        
        if (meeting.previousMeetingId() == null) {
            return new MeetingContext(null, null, List.of(), List.of());
        }

        Meeting previous = meetingRepository.findById(meeting.previousMeetingId())
                .orElse(null);
        
        if (previous == null) {
            return new MeetingContext(null, null, List.of(), List.of());
        }

        Optional<Summary> previousSummary = summaryRepository.findByMeetingId(previous.id());
        List<NotesBlockParser.ActionItem> openItems = blockParser.extractActionItems(previous.liveNotes())
                .stream()
                .filter(item -> !item.completed())
                .toList();
        List<String> decisions = blockParser.extractDecisions(previous.liveNotes());

        return new MeetingContext(
                previous,
                previousSummary.map(Summary::textMd).orElse(null),
                openItems,
                decisions
        );
    }

    /**
     * Builds context string for GPT prompt injection.
     */
    public String buildContextForGpt(UUID meetingId) {
        MeetingContext context = getPreviousMeetingContext(meetingId);
        
        if (context.previousMeeting() == null) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("\n\n--- CONTEXTO DA REUNIÃO ANTERIOR ---\n");
        
        if (context.previousSummary() != null) {
            sb.append("\n### Resumo Anterior:\n");
            sb.append(context.previousSummary());
        }
        
        if (!context.openActionItems().isEmpty()) {
            sb.append("\n\n### Itens Pendentes:\n");
            for (NotesBlockParser.ActionItem item : context.openActionItems()) {
                sb.append("- [ ] ");
                if (item.assignee() != null) {
                    sb.append("@").append(item.assignee()).append(" ");
                }
                sb.append(item.textWithoutMention()).append("\n");
            }
        }
        
        if (!context.previousDecisions().isEmpty()) {
            sb.append("\n\n### Decisões Anteriores:\n");
            for (String decision : context.previousDecisions()) {
                sb.append("- ").append(decision).append("\n");
            }
        }
        
        sb.append("\n--- FIM DO CONTEXTO ANTERIOR ---\n\n");
        
        return sb.toString();
    }

    // =========================================================================
    // Series Operations
    // =========================================================================

    /**
     * Creates a new meeting series.
     */
    public MeetingSeries createSeries(String name, String description) {
        MeetingSeries series = MeetingSeries.create(name, description);
        return seriesRepository.create(series);
    }

    /**
     * Adds a meeting to a series.
     */
    @Transactional
    public Meeting addToSeries(UUID meetingId, UUID seriesId) {
        validateMeetingExists(meetingId);
        MeetingSeries series = seriesRepository.findById(seriesId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, 
                        "SERIES_NOT_FOUND", "Meeting series not found: " + seriesId));

        // Calculate next sequence number
        List<Meeting> seriesMeetings = meetingRepository.findBySeriesId(seriesId);
        int nextSequence = seriesMeetings.stream()
                .mapToInt(m -> m.sequenceNum() != null ? m.sequenceNum() : 0)
                .max()
                .orElse(0) + 1;

        meetingRepository.updateSeries(meetingId, seriesId, nextSequence);
        
        // Auto-link to previous meeting in series if exists
        if (!seriesMeetings.isEmpty()) {
            Meeting lastInSeries = seriesMeetings.get(seriesMeetings.size() - 1);
            meetingRepository.updatePreviousMeeting(meetingId, lastInSeries.id());
        }

        log.info("Added meeting={} to series={} with sequence={}", meetingId, seriesId, nextSequence);
        return meetingRepository.findById(meetingId).orElseThrow();
    }

    /**
     * Gets all meetings in a series.
     */
    public List<Meeting> getSeriesMeetings(UUID seriesId) {
        return meetingRepository.findBySeriesId(seriesId);
    }

    /**
     * Gets all meeting series.
     */
    public List<MeetingSeries> getAllSeries() {
        return seriesRepository.findAll();
    }

    // =========================================================================
    // User Preferences
    // =========================================================================

    /**
     * Gets or creates user preferences.
     */
    public UserPreference getOrCreatePreferences(String userId) {
        return preferenceRepository.findByUserId(userId)
                .orElseGet(() -> preferenceRepository.create(UserPreference.create(userId)));
    }

    /**
     * Updates user preferences.
     */
    @Transactional
    public UserPreference updatePreferences(String userId, String language, String customTemplate) {
        UserPreference existing = getOrCreatePreferences(userId);
        UserPreference updated = new UserPreference(
                existing.id(),
                userId,
                language != null ? language : existing.defaultLanguage(),
                customTemplate != null ? customTemplate : existing.notesTemplate(),
                existing.createdAt(),
                java.time.OffsetDateTime.now()
        );
        return preferenceRepository.upsert(updated);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private Meeting validateMeetingExists(UUID meetingId) {
        return meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "MEETING_NOT_FOUND", "Meeting not found: " + meetingId));
    }

    /**
     * Context from a previous meeting for continuity.
     */
    public record MeetingContext(
            Meeting previousMeeting,
            String previousSummary,
            List<NotesBlockParser.ActionItem> openActionItems,
            List<String> previousDecisions
    ) {}
}
