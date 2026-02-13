package com.decisiondesk.backend.notes.service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.decisiondesk.backend.meetings.MeetingStatus;
import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.model.Transcript;
import com.decisiondesk.backend.meetings.persistence.MeetingRepository;
import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.web.ApiException;

/**
 * Service for importing transcripts from external sources (Teams, Zoom, etc.)
 */
@Service
public class TranscriptImportService {

    private static final Logger log = LoggerFactory.getLogger(TranscriptImportService.class);

    // Supported import sources
    public static final String SOURCE_TEAMS = "teams";
    public static final String SOURCE_ZOOM = "zoom";
    public static final String SOURCE_WEBEX = "webex";
    public static final String SOURCE_MANUAL = "manual";

    // VTT timestamp pattern: 00:00:00.000 --> 00:00:05.000
    private static final Pattern VTT_TIMESTAMP_PATTERN = Pattern.compile(
            "\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\s*-->\\s*\\d{2}:\\d{2}:\\d{2}\\.\\d{3}"
    );

    // Teams transcript speaker pattern: <v Speaker Name>text</v>
    private static final Pattern TEAMS_SPEAKER_PATTERN = Pattern.compile(
            "<v\\s+([^>]+)>([^<]*)</v>"
    );

    private final MeetingRepository meetingRepository;
    private final TranscriptRepository transcriptRepository;

    public TranscriptImportService(
            MeetingRepository meetingRepository,
            TranscriptRepository transcriptRepository) {
        this.meetingRepository = meetingRepository;
        this.transcriptRepository = transcriptRepository;
    }

    /**
     * Imports a transcript file and creates a meeting.
     * Supports: .vtt, .txt, .docx
     */
    @Transactional
    public ImportResult importTranscript(MultipartFile file, String source, String title) {
        validateFile(file);
        
        String filename = file.getOriginalFilename();
        String content;
        String detectedSource = source != null ? source : detectSource(filename);

        try {
            content = parseFile(file);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                    "IMPORT_FAILED", "Failed to parse file: " + e.getMessage());
        }

        if (content == null || content.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                    "EMPTY_CONTENT", "File contains no text content");
        }

        // Clean content based on format
        String cleanedContent = cleanContent(content, filename);
        
        // Create meeting
        Meeting meeting = meetingRepository.create();
        
        // Update meeting with title and source
        if (title != null && !title.isBlank()) {
            meetingRepository.updateTitle(meeting.id(), title);
        }
        meetingRepository.updateImportedSource(meeting.id(), detectedSource);
        meetingRepository.updateStatus(meeting.id(), MeetingStatus.DONE);

        // Create transcript
        Transcript transcript = new Transcript(
                UUID.randomUUID(),
                meeting.id(),
                detectLanguage(cleanedContent),
                cleanedContent,
                java.time.OffsetDateTime.now()
        );
        transcriptRepository.upsert(transcript);

        log.info("Imported transcript from {} for meeting={}, length={} chars", 
                detectedSource, meeting.id(), cleanedContent.length());

        return new ImportResult(
                meetingRepository.findById(meeting.id()).orElseThrow(),
                cleanedContent.length(),
                detectedSource
        );
    }

    /**
     * Imports a transcript into an existing meeting.
     */
    @Transactional
    public ImportResult importIntoMeeting(UUID meetingId, MultipartFile file, String source) {
        Meeting meeting = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, 
                        "MEETING_NOT_FOUND", "Meeting not found: " + meetingId));

        validateFile(file);
        
        String filename = file.getOriginalFilename();
        String detectedSource = source != null ? source : detectSource(filename);

        try {
            String content = parseFile(file);
            String cleanedContent = cleanContent(content, filename);

            // Update meeting source
            meetingRepository.updateImportedSource(meetingId, detectedSource);
            meetingRepository.updateStatus(meetingId, MeetingStatus.DONE);

            // Upsert transcript
            Transcript transcript = new Transcript(
                    UUID.randomUUID(),
                    meetingId,
                    detectLanguage(cleanedContent),
                    cleanedContent,
                    java.time.OffsetDateTime.now()
            );
            transcriptRepository.upsert(transcript);

            log.info("Imported transcript into existing meeting={}, source={}", meetingId, detectedSource);

            return new ImportResult(
                    meetingRepository.findById(meetingId).orElseThrow(),
                    cleanedContent.length(),
                    detectedSource
            );
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                    "IMPORT_FAILED", "Failed to parse file: " + e.getMessage());
        }
    }

    /**
     * Imports plain text as transcript.
     */
    @Transactional
    public ImportResult importText(String text, String title, String source) {
        if (text == null || text.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                    "EMPTY_CONTENT", "Text content is required");
        }

        Meeting meeting = meetingRepository.create();
        
        if (title != null && !title.isBlank()) {
            meetingRepository.updateTitle(meeting.id(), title);
        }
        meetingRepository.updateImportedSource(meeting.id(), source != null ? source : SOURCE_MANUAL);
        meetingRepository.updateStatus(meeting.id(), MeetingStatus.DONE);

        Transcript transcript = new Transcript(
                UUID.randomUUID(),
                meeting.id(),
                detectLanguage(text),
                text,
                java.time.OffsetDateTime.now()
        );
        transcriptRepository.upsert(transcript);

        log.info("Imported text transcript for meeting={}, length={} chars", 
                meeting.id(), text.length());

        return new ImportResult(
                meetingRepository.findById(meeting.id()).orElseThrow(),
                text.length(),
                source != null ? source : SOURCE_MANUAL
        );
    }

    // =========================================================================
    // Parsing Logic
    // =========================================================================

    private String parseFile(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename();
        if (filename == null) {
            filename = "";
        }
        filename = filename.toLowerCase();

        if (filename.endsWith(".docx")) {
            return parseDocx(file.getInputStream());
        } else if (filename.endsWith(".vtt")) {
            return parseVtt(file.getInputStream());
        } else {
            // Treat as plain text
            return parseTxt(file.getInputStream());
        }
    }

    private String parseDocx(InputStream is) throws IOException {
        StringBuilder content = new StringBuilder();
        try (XWPFDocument doc = new XWPFDocument(is)) {
            for (XWPFParagraph para : doc.getParagraphs()) {
                String text = para.getText();
                if (text != null && !text.isBlank()) {
                    content.append(text).append("\n");
                }
            }
        }
        return content.toString();
    }

    private String parseVtt(InputStream is) throws IOException {
        StringBuilder content = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            boolean skipNext = false;
            
            while ((line = reader.readLine()) != null) {
                // Skip WEBVTT header
                if (line.startsWith("WEBVTT") || line.startsWith("NOTE")) {
                    continue;
                }
                // Skip timestamps
                if (VTT_TIMESTAMP_PATTERN.matcher(line).find()) {
                    skipNext = false;
                    continue;
                }
                // Skip cue identifiers (numbers)
                if (line.matches("^\\d+$")) {
                    continue;
                }
                // Skip empty lines
                if (line.isBlank()) {
                    continue;
                }
                
                // Extract speaker from Teams format
                Matcher speakerMatcher = TEAMS_SPEAKER_PATTERN.matcher(line);
                if (speakerMatcher.find()) {
                    String speaker = speakerMatcher.group(1);
                    String text = speakerMatcher.group(2);
                    content.append(speaker).append(": ").append(text).append("\n");
                } else {
                    // Plain text line
                    content.append(line).append("\n");
                }
            }
        }
        return content.toString();
    }

    private String parseTxt(InputStream is) throws IOException {
        StringBuilder content = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
        }
        return content.toString();
    }

    private String cleanContent(String content, String filename) {
        if (content == null) return "";
        
        // Remove duplicate consecutive lines
        String[] lines = content.split("\n");
        StringBuilder cleaned = new StringBuilder();
        String lastLine = "";
        
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty() && !trimmed.equals(lastLine)) {
                cleaned.append(trimmed).append("\n");
                lastLine = trimmed;
            }
        }
        
        return cleaned.toString().trim();
    }

    // =========================================================================
    // Detection
    // =========================================================================

    private String detectSource(String filename) {
        if (filename == null) return SOURCE_MANUAL;
        String lower = filename.toLowerCase();
        
        if (lower.contains("teams") || lower.contains("microsoft")) {
            return SOURCE_TEAMS;
        } else if (lower.contains("zoom")) {
            return SOURCE_ZOOM;
        } else if (lower.contains("webex")) {
            return SOURCE_WEBEX;
        }
        
        return SOURCE_MANUAL;
    }

    private String detectLanguage(String content) {
        if (content == null || content.length() < 50) {
            return "en";
        }
        
        // Simple heuristic: check for common Portuguese words
        String lower = content.toLowerCase();
        int ptScore = 0;
        int enScore = 0;
        
        String[] ptWords = {"reunião", "obrigado", "então", "também", "não", "está", "isso", "para", "sobre"};
        String[] enWords = {"meeting", "thank", "about", "this", "that", "with", "from", "have", "will"};
        
        for (String word : ptWords) {
            if (lower.contains(word)) ptScore++;
        }
        for (String word : enWords) {
            if (lower.contains(word)) enScore++;
        }
        
        if (ptScore > enScore) {
            return "pt";
        } else if (enScore > ptScore) {
            return "en";
        }
        
        return "en"; // Default
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                    "INVALID_FILE", "File is required");
        }

        String filename = file.getOriginalFilename();
        if (filename == null) {
            filename = "";
        }
        String lower = filename.toLowerCase();

        if (!lower.endsWith(".vtt") && !lower.endsWith(".txt") && !lower.endsWith(".docx")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                    "UNSUPPORTED_FORMAT", "Supported formats: .vtt, .txt, .docx");
        }

        // Max 10MB
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new ApiException(HttpStatus.BAD_REQUEST, 
                    "FILE_TOO_LARGE", "File must be less than 10MB");
        }
    }

    /**
     * Result of a transcript import operation.
     */
    public record ImportResult(
            Meeting meeting,
            int characterCount,
            String source
    ) {}
}
