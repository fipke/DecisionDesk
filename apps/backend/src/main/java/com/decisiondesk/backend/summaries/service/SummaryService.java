package com.decisiondesk.backend.summaries.service;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.decisiondesk.backend.meetings.model.Transcript;
import com.decisiondesk.backend.meetings.model.UsageRecord;
import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.meetings.persistence.UsageRecordRepository;
import com.decisiondesk.backend.openai.GptClient;
import com.decisiondesk.backend.openai.GptCompletion;
import com.decisiondesk.backend.summaries.model.Summary;
import com.decisiondesk.backend.summaries.model.SummaryTemplate;
import com.decisiondesk.backend.summaries.persistence.SummaryRepository;
import com.decisiondesk.backend.summaries.persistence.SummaryTemplateRepository;
import com.decisiondesk.backend.web.ApiException;

/**
 * Service for generating meeting summaries using GPT.
 */
@Service
public class SummaryService {

    private static final Logger log = LoggerFactory.getLogger(SummaryService.class);
    private static final BigDecimal USD_TO_BRL = new BigDecimal("5.0");

    private final TranscriptRepository transcriptRepository;
    private final SummaryRepository summaryRepository;
    private final SummaryTemplateRepository templateRepository;
    private final UsageRecordRepository usageRecordRepository;
    private final GptClient gptClient;

    public SummaryService(
            TranscriptRepository transcriptRepository,
            @Qualifier("summariesSummaryRepository") SummaryRepository summaryRepository,
            SummaryTemplateRepository templateRepository,
            UsageRecordRepository usageRecordRepository,
            GptClient gptClient) {
        this.transcriptRepository = transcriptRepository;
        this.summaryRepository = summaryRepository;
        this.templateRepository = templateRepository;
        this.usageRecordRepository = usageRecordRepository;
        this.gptClient = gptClient;
    }

    /**
     * Generates a summary for a meeting using the specified template.
     * If no templateId is provided, uses the default template.
     *
     * @param meetingId the meeting ID
     * @param templateId optional template ID (uses default if null)
     * @return the generated summary
     */
    @Transactional
    public Summary generateSummary(UUID meetingId, UUID templateId) {
        // Get transcript
        Transcript transcript = transcriptRepository.findByMeetingId(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                        "NO_TRANSCRIPT", "Meeting has no transcript to summarize"));

        // Get template
        SummaryTemplate template = resolveTemplate(templateId);
        
        log.info("Generating summary for meeting={} using template={}", 
                meetingId, template.name());

        // Build prompts
        String userPrompt = template.buildUserPrompt(transcript.text());
        
        // Call GPT
        GptCompletion completion = gptClient.chatCompletion(
                template.systemPrompt(),
                userPrompt,
                template.model(),
                template.maxTokens(),
                template.temperature()
        );

        // Calculate costs
        BigDecimal costUsd = completion.calculateCostUsd();
        BigDecimal costBrl = costUsd.multiply(USD_TO_BRL);

        // Save usage record
        UsageRecord usageRecord = new UsageRecord(
                UUID.randomUUID(),
                meetingId,
                UsageRecord.Service.GPT,
                new BigDecimal(completion.totalTokens()),
                costUsd,
                costBrl,
                buildUsageMeta(template, completion),
                null
        );
        usageRecordRepository.insert(usageRecord);
        
        log.info("GPT usage recorded: meeting={}, tokens={}, costUsd={}", 
                meetingId, completion.totalTokens(), costUsd);

        // Save summary
        Summary summary = Summary.create(
                meetingId,
                completion.content(),
                template.id(),
                completion.model(),
                completion.totalTokens()
        );
        
        return summaryRepository.upsert(summary);
    }

    /**
     * Gets the existing summary for a meeting if available.
     */
    public Optional<Summary> getSummary(UUID meetingId) {
        return summaryRepository.findByMeetingId(meetingId);
    }

    private SummaryTemplate resolveTemplate(UUID templateId) {
        if (templateId != null) {
            return templateRepository.findById(templateId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                            "TEMPLATE_NOT_FOUND", "Summary template not found: " + templateId));
        }
        return templateRepository.findDefault()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "NO_DEFAULT_TEMPLATE", "No default summary template configured"));
    }

    private String buildUsageMeta(SummaryTemplate template, GptCompletion completion) {
        return String.format(
                "{\"template_id\":\"%s\",\"template_name\":\"%s\",\"model\":\"%s\",\"prompt_tokens\":%d,\"completion_tokens\":%d}",
                template.id(),
                template.name(),
                completion.model(),
                completion.promptTokens(),
                completion.completionTokens()
        );
    }
}
