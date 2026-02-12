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

    /**
     * Creates a new meeting type.
     *
     * @param name meeting type name
     * @param description description
     * @param requiredTags required tags
     * @param defaultWhisperModel default whisper model
     * @return the created meeting type
     */
    public MeetingType createMeetingType(String name, String description, 
            Map<String, String> requiredTags, String defaultWhisperModel) {
        
        MeetingType meetingType = new MeetingType(
            UUID.randomUUID(),
            name,
            description,
            requiredTags != null ? requiredTags : Map.of(),
            defaultWhisperModel,
            null,
            java.time.OffsetDateTime.now()
        );
        
        return meetingTypeRepository.create(meetingType);
    }

    /**
     * Gets a meeting type by id.
     *
     * @param id meeting type id
     * @return the meeting type
     * @throws MeetingTypeNotFoundException if not found
     */
    public MeetingType getMeetingType(UUID id) {
        return meetingTypeRepository.findById(id)
            .orElseThrow(() -> new MeetingTypeNotFoundException(id));
    }

    /**
     * Gets all meeting types.
     *
     * @return list of all meeting types
     */
    public List<MeetingType> getAllMeetingTypes() {
        return meetingTypeRepository.findAll();
    }

    /**
     * Updates a meeting type.
     *
     * @param id meeting type id
     * @param name new name (null to keep)
     * @param description new description (null to keep)
     * @param requiredTags new required tags (null to keep)
     * @param defaultWhisperModel new model (null to keep)
     * @return the updated meeting type
     */
    public MeetingType updateMeetingType(UUID id, String name, String description,
            Map<String, String> requiredTags, String defaultWhisperModel) {
        MeetingType existing = getMeetingType(id);
        
        MeetingType updated = new MeetingType(
            existing.id(),
            name != null ? name : existing.name(),
            description != null ? description : existing.description(),
            requiredTags != null ? requiredTags : existing.requiredTags(),
            defaultWhisperModel != null ? defaultWhisperModel : existing.defaultWhisperModel(),
            existing.summaryTemplateId(),
            existing.createdAt()
        );
        
        meetingTypeRepository.update(updated);
        return meetingTypeRepository.findById(id).orElseThrow();
    }

    /**
     * Deletes a meeting type.
     *
     * @param id meeting type id
     */
    public void deleteMeetingType(UUID id) {
        meetingTypeRepository.deleteById(id);
    }

    /**
     * Exception thrown when a meeting type is not found.
     */
    public static class MeetingTypeNotFoundException extends RuntimeException {
        public MeetingTypeNotFoundException(UUID id) {
            super("Meeting type not found: " + id);
        }
    }
}
