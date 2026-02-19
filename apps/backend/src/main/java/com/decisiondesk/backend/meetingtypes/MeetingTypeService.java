package com.decisiondesk.backend.meetingtypes;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.decisiondesk.backend.meetingtypes.model.MeetingType;
import com.decisiondesk.backend.meetingtypes.persistence.MeetingTypeRepository;

/**
 * Service layer for meeting type operations.
 */
@Service
public class MeetingTypeService {

    private final MeetingTypeRepository meetingTypeRepository;

    public MeetingTypeService(MeetingTypeRepository meetingTypeRepository) {
        this.meetingTypeRepository = meetingTypeRepository;
    }

    public MeetingType createMeetingType(String name, String description,
            Map<String, String> requiredTags, String defaultWhisperModel,
            List<UUID> summaryTemplateIds, Map<String, Object> extractionConfig,
            String aiProvider, List<UUID> defaultParticipants, String icon, String color) {

        MeetingType meetingType = new MeetingType(
            UUID.randomUUID(),
            name,
            description,
            requiredTags != null ? requiredTags : Map.of(),
            defaultWhisperModel,
            null,
            summaryTemplateIds != null ? summaryTemplateIds : List.of(),
            extractionConfig != null ? extractionConfig : Map.of("action_items", true, "decisions", true, "deadlines", true),
            aiProvider != null ? aiProvider : "ollama",
            defaultParticipants != null ? defaultParticipants : List.of(),
            icon,
            color,
            java.time.OffsetDateTime.now()
        );

        return meetingTypeRepository.create(meetingType);
    }

    /**
     * Backwards-compatible create with original 4 params.
     */
    public MeetingType createMeetingType(String name, String description,
            Map<String, String> requiredTags, String defaultWhisperModel) {
        return createMeetingType(name, description, requiredTags, defaultWhisperModel,
                null, null, null, null, null, null);
    }

    public MeetingType getMeetingType(UUID id) {
        return meetingTypeRepository.findById(id)
            .orElseThrow(() -> new MeetingTypeNotFoundException(id));
    }

    public List<MeetingType> getAllMeetingTypes() {
        return meetingTypeRepository.findAll();
    }

    public MeetingType updateMeetingType(UUID id, String name, String description,
            Map<String, String> requiredTags, String defaultWhisperModel,
            List<UUID> summaryTemplateIds, Map<String, Object> extractionConfig,
            String aiProvider, List<UUID> defaultParticipants, String icon, String color) {
        MeetingType existing = getMeetingType(id);

        MeetingType updated = new MeetingType(
            existing.id(),
            name != null ? name : existing.name(),
            description != null ? description : existing.description(),
            requiredTags != null ? requiredTags : existing.requiredTags(),
            defaultWhisperModel != null ? defaultWhisperModel : existing.defaultWhisperModel(),
            existing.summaryTemplateId(),
            summaryTemplateIds != null ? summaryTemplateIds : existing.summaryTemplateIds(),
            extractionConfig != null ? extractionConfig : existing.extractionConfig(),
            aiProvider != null ? aiProvider : existing.aiProvider(),
            defaultParticipants != null ? defaultParticipants : existing.defaultParticipants(),
            icon != null ? icon : existing.icon(),
            color != null ? color : existing.color(),
            existing.createdAt()
        );

        meetingTypeRepository.update(updated);
        return meetingTypeRepository.findById(id).orElseThrow();
    }

    /**
     * Backwards-compatible update with original 4 params.
     */
    public MeetingType updateMeetingType(UUID id, String name, String description,
            Map<String, String> requiredTags, String defaultWhisperModel) {
        return updateMeetingType(id, name, description, requiredTags, defaultWhisperModel,
                null, null, null, null, null, null);
    }

    public void deleteMeetingType(UUID id) {
        meetingTypeRepository.deleteById(id);
    }

    public static class MeetingTypeNotFoundException extends RuntimeException {
        public MeetingTypeNotFoundException(UUID id) {
            super("Meeting type not found: " + id);
        }
    }
}
