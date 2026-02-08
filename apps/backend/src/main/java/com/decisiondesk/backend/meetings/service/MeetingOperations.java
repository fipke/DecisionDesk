package com.decisiondesk.backend.meetings.service;

import java.util.UUID;

import org.springframework.web.multipart.MultipartFile;

import com.decisiondesk.backend.meetings.model.AudioUploadResult;
import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.model.MeetingDetails;

/**
 * Contract exposed to controllers for meeting operations.
 */
public interface MeetingOperations {

    Meeting createMeeting();

    AudioUploadResult uploadAudio(UUID meetingId, MultipartFile file);

    MeetingDetails getMeeting(UUID meetingId);
}
