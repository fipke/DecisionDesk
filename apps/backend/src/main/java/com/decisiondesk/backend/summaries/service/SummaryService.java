package com.decisiondesk.backend.summaries.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.decisiondesk.backend.meetings.model.Meeting;
import com.decisiondesk.backend.meetings.model.Transcript;
import com.decisiondesk.backend.meetings.model.UsageRecord;
import com.decisiondesk.backend.meetings.persistence.MeetingRepository;
import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.meetings.persistence.UsageRecordRepository;
import com.decisiondesk.backend.meetingtypes.model.MeetingType;
import com.decisiondesk.backend.meetingtypes.persistence.MeetingTypeRepository;
import com.decisiondesk.backend.ai.AiCompletion;
import com.decisiondesk.backend.ai.AiCompletionProvider;
import com.decisiondesk.backend.ai.AiProviderRouter;
import com.decisiondesk.backend.notes.persistence.UserPreferenceRepository;
import com.decisiondesk.backend.summaries.model.Summary;
import com.decisiondesk.backend.summaries.model.SummaryTemplate;
import com.decisiondesk.backend.summaries.persistence.SummaryRepository;
import com.decisiondesk.backend.summaries.persistence.SummaryTemplateRepository;
import com.decisiondesk.backend.web.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Service for generating meeting summaries using AI providers (OpenAI / Ollama).
 * Supports multiple summaries per meeting (one per template).
 */
@Service
public class SummaryService {

    private static final Logger log = LoggerFactory.getLogger(SummaryService.class);
    private static final BigDecimal USD_TO_BRL = new BigDecimal("5.0");
    private static final String DEFAULT_USER = "default";
    private static final String DEFAULT_PROVIDER = "ollama";
    private static final String DEFAULT_MODEL = "qwen3:14b";

    private final TranscriptRepository transcriptRepository;
    private final SummaryRepository summaryRepository;
    private final SummaryTemplateRepository templateRepository;
    private final UsageRecordRepository usageRecordRepository;
    private final MeetingRepository meetingRepository;
    private final MeetingTypeRepository meetingTypeRepository;
    private final AiProviderRouter aiProviderRouter;
    private final UserPreferenceRepository preferenceRepository;
    private final ObjectMapper objectMapper;

    public SummaryService(
            TranscriptRepository transcriptRepository,
            @Qualifier("summariesSummaryRepository") SummaryRepository summaryRepository,
            SummaryTemplateRepository templateRepository,
            UsageRecordRepository usageRecordRepository,
            MeetingRepository meetingRepository,
            MeetingTypeRepository meetingTypeRepository,
            AiProviderRouter aiProviderRouter,
            UserPreferenceRepository preferenceRepository,
            ObjectMapper objectMapper) {
        this.transcriptRepository = transcriptRepository;
        this.summaryRepository = summaryRepository;
        this.templateRepository = templateRepository;
        this.usageRecordRepository = usageRecordRepository;
        this.meetingRepository = meetingRepository;
        this.meetingTypeRepository = meetingTypeRepository;
        this.aiProviderRouter = aiProviderRouter;
        this.preferenceRepository = preferenceRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Generates a summary for a meeting using the specified template.
     * If no templateId is provided, uses the default template.
     * Re-generating with the same template overwrites the previous summary for that template.
     */
    @Transactional
    public Summary generateSummary(UUID meetingId, UUID templateId,
                                    String providerName, String modelOverride) {
        Transcript transcript = transcriptRepository.findByMeetingId(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                        "NO_TRANSCRIPT", "Meeting has no transcript to summarize"));

        SummaryTemplate template = resolveTemplate(templateId);

        AiCompletionProvider provider = resolveProvider(providerName);
        String effectiveModel = resolveModel(modelOverride, template.model());

        log.info("Generating summary for meeting={} using template={} provider={} model={}",
                meetingId, template.name(), provider.name(), effectiveModel);

        String userPrompt = template.buildUserPrompt(transcript.text());

        AiCompletion completion = provider.chatCompletion(
                template.systemPrompt(),
                userPrompt,
                effectiveModel,
                template.maxTokens(),
                template.temperature()
        );

        recordUsage(meetingId, template, completion);

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
     * Generates a summary with optional prompt overrides and save-as-template option.
     */
    @Transactional
    public Summary generateSummary(UUID meetingId, UUID templateId,
                                    String systemPromptOverride, String userPromptOverride,
                                    boolean saveAsTemplate, String newTemplateName,
                                    String providerName, String modelOverride) {
        Transcript transcript = transcriptRepository.findByMeetingId(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                        "NO_TRANSCRIPT", "Meeting has no transcript to summarize"));

        SummaryTemplate template = resolveTemplate(templateId);

        String systemPrompt = systemPromptOverride != null ? systemPromptOverride : template.systemPrompt();
        String userPrompt = userPromptOverride != null ? userPromptOverride : template.buildUserPrompt(transcript.text());
        if (userPromptOverride == null && systemPromptOverride != null) {
            userPrompt = template.buildUserPrompt(transcript.text());
        }

        AiCompletionProvider provider = resolveProvider(providerName);
        String effectiveModel = resolveModel(modelOverride, template.model());

        log.info("Generating summary for meeting={} using template={} provider={} model={} (overrides: sys={}, user={})",
                meetingId, template.name(), provider.name(), effectiveModel,
                systemPromptOverride != null, userPromptOverride != null);

        AiCompletion completion = provider.chatCompletion(
                systemPrompt, userPrompt, effectiveModel, template.maxTokens(), template.temperature());

        recordUsage(meetingId, template, completion);

        UUID effectiveTemplateId = template.id();
        if (saveAsTemplate && newTemplateName != null) {
            SummaryTemplate newTemplate = SummaryTemplate.create(
                    newTemplateName, systemPrompt, template.userPromptTemplate());
            templateRepository.create(newTemplate);
            effectiveTemplateId = newTemplate.id();
            log.info("Saved new template: id={}, name={}", newTemplate.id(), newTemplateName);
        }

        Summary summary = Summary.create(meetingId, completion.content(),
                effectiveTemplateId, completion.model(), completion.totalTokens());
        return summaryRepository.upsert(summary);
    }

    /**
     * Gets the first/oldest summary for a meeting (backwards-compatible).
     */
    public Optional<Summary> getSummary(UUID meetingId) {
        return summaryRepository.findByMeetingId(meetingId);
    }

    /**
     * Gets all summaries for a meeting.
     */
    public List<Summary> getAllSummaries(UUID meetingId) {
        return summaryRepository.findAllByMeetingId(meetingId);
    }

    /**
     * Generates all summaries configured in the meeting's type.
     * Runs each template sequentially, skipping failures to avoid blocking others.
     *
     * @return list of successfully generated summaries
     */
    @Transactional
    public List<Summary> generateAllForMeetingType(UUID meetingId) {
        Meeting meeting = meetingRepository.findById(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "MEETING_NOT_FOUND", "Meeting not found: " + meetingId));

        if (meeting.meetingTypeId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "NO_MEETING_TYPE", "Meeting has no type assigned");
        }

        MeetingType meetingType = meetingTypeRepository.findById(meeting.meetingTypeId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "MEETING_TYPE_NOT_FOUND", "Meeting type not found: " + meeting.meetingTypeId()));

        List<UUID> templateIds = meetingType.summaryTemplateIds();
        if (templateIds == null || templateIds.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "NO_TEMPLATES_CONFIGURED", "Meeting type has no summary templates configured");
        }

        log.info("Generating {} summaries for meeting={} type={}",
                templateIds.size(), meetingId, meetingType.name());

        return templateIds.stream()
                .map(templateId -> {
                    try {
                        return generateSummary(meetingId, templateId, null, null);
                    } catch (Exception e) {
                        log.error("Failed to generate summary for meeting={} template={}: {}",
                                meetingId, templateId, e.getMessage());
                        return null;
                    }
                })
                .filter(s -> s != null)
                .toList();
    }

    /**
     * Deletes a specific summary by ID.
     */
    public boolean deleteSummary(UUID summaryId) {
        return summaryRepository.deleteById(summaryId);
    }

    @SuppressWarnings("unchecked")
    private AiCompletionProvider resolveProvider(String providerOverride) {
        if (providerOverride != null && !providerOverride.isBlank()) {
            return aiProviderRouter.getProvider(providerOverride);
        }
        try {
            return preferenceRepository.findByUserId(DEFAULT_USER)
                    .filter(p -> p.aiConfig() != null)
                    .map(p -> {
                        try {
                            Map<String, Object> config = objectMapper.readValue(p.aiConfig(), Map.class);
                            Object summarization = config.get("summarization");
                            if (summarization instanceof Map<?, ?> s) {
                                Object provider = s.get("provider");
                                if (provider instanceof String name && !name.isBlank()) {
                                    return aiProviderRouter.getProvider(name);
                                }
                            }
                        } catch (Exception e) {
                            log.warn("Failed to parse AI config for provider resolution: {}", e.getMessage());
                        }
                        return (AiCompletionProvider) null;
                    })
                    .orElse(aiProviderRouter.getProvider(DEFAULT_PROVIDER));
        } catch (Exception e) {
            log.warn("Failed to read AI settings, falling back to {}: {}", DEFAULT_PROVIDER, e.getMessage());
            return aiProviderRouter.getProvider(DEFAULT_PROVIDER);
        }
    }

    @SuppressWarnings("unchecked")
    private String resolveModel(String modelOverride, String templateModel) {
        if (modelOverride != null && !modelOverride.isBlank()) {
            return modelOverride;
        }
        try {
            String fromSettings = preferenceRepository.findByUserId(DEFAULT_USER)
                    .filter(p -> p.aiConfig() != null)
                    .map(p -> {
                        try {
                            Map<String, Object> config = objectMapper.readValue(p.aiConfig(), Map.class);
                            Object summarization = config.get("summarization");
                            if (summarization instanceof Map<?, ?> s) {
                                Object model = s.get("model");
                                if (model instanceof String name && !name.isBlank()) {
                                    return name;
                                }
                            }
                        } catch (Exception e) {
                            log.warn("Failed to parse AI config for model resolution: {}", e.getMessage());
                        }
                        return (String) null;
                    })
                    .orElse(null);
            if (fromSettings != null) {
                return fromSettings;
            }
        } catch (Exception e) {
            log.warn("Failed to read AI settings for model, using template default: {}", e.getMessage());
        }
        if (templateModel != null && !templateModel.isBlank()) {
            return templateModel;
        }
        return DEFAULT_MODEL;
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

    private void recordUsage(UUID meetingId, SummaryTemplate template, AiCompletion completion) {
        BigDecimal costUsd = completion.calculateCostUsd();
        BigDecimal costBrl = costUsd.multiply(USD_TO_BRL);

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

        log.info("AI usage recorded: provider={}, meeting={}, tokens={}, costUsd={}",
                completion.provider(), meetingId, completion.totalTokens(), costUsd);
    }

    private String buildUsageMeta(SummaryTemplate template, AiCompletion completion) {
        return String.format(
                "{\"template_id\":\"%s\",\"template_name\":\"%s\",\"model\":\"%s\",\"provider\":\"%s\",\"prompt_tokens\":%d,\"completion_tokens\":%d}",
                template.id(),
                template.name(),
                completion.model(),
                completion.provider(),
                completion.promptTokens(),
                completion.completionTokens()
        );
    }
}
