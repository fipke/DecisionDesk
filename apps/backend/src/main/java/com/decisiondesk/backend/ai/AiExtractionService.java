package com.decisiondesk.backend.ai;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.web.ApiException;

/**
 * Extracts structured data (action items, decisions, deadlines) from meeting transcripts
 * using the configured AI provider.
 */
@Service
public class AiExtractionService {

    private static final Logger log = LoggerFactory.getLogger(AiExtractionService.class);

    private static final String EXTRACTION_SYSTEM_PROMPT = """
            You are a meeting assistant that extracts structured information from meeting transcripts.
            Extract the requested items and return them as a JSON object.
            Always respond in the same language as the transcript.
            Be precise and concise. Only include items explicitly discussed.
            """;

    private static final String EXTRACTION_USER_TEMPLATE = """
            Extract the following from this meeting transcript:
            %s

            Return a JSON object with these keys (only include requested ones):
            - "action_items": array of {text, assignee, deadline}
            - "decisions": array of strings
            - "deadlines": array of {text, date}
            - "backlog": array of strings (items to revisit later)

            Transcript:
            %s
            """;

    private final AiProviderRouter aiProviderRouter;
    private final TranscriptRepository transcriptRepository;

    public AiExtractionService(AiProviderRouter aiProviderRouter,
                                TranscriptRepository transcriptRepository) {
        this.aiProviderRouter = aiProviderRouter;
        this.transcriptRepository = transcriptRepository;
    }

    /**
     * Extracts structured data from a meeting transcript.
     *
     * @param meetingId the meeting to extract from
     * @param config extraction config (keys: action_items, decisions, deadlines, backlog)
     * @param providerName optional provider override ("ollama" or "openai")
     * @param model optional model override
     * @return extracted JSON as string
     */
    public ExtractionResult extract(UUID meetingId, Map<String, Object> config,
                                     String providerName, String model) {
        String transcriptText = transcriptRepository.findByMeetingId(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                        "NO_TRANSCRIPT", "Meeting has no transcript"))
                .text();

        StringBuilder requestedItems = new StringBuilder();
        if (Boolean.TRUE.equals(config.get("action_items"))) requestedItems.append("- Action items (tasks, to-dos)\n");
        if (Boolean.TRUE.equals(config.get("decisions"))) requestedItems.append("- Decisions made\n");
        if (Boolean.TRUE.equals(config.get("deadlines"))) requestedItems.append("- Deadlines mentioned\n");
        if (Boolean.TRUE.equals(config.get("backlog"))) requestedItems.append("- Backlog items (deferred topics)\n");

        if (requestedItems.isEmpty()) {
            requestedItems.append("- Action items\n- Decisions made\n- Deadlines mentioned\n");
        }

        String userPrompt = String.format(EXTRACTION_USER_TEMPLATE,
                requestedItems, transcriptText);

        AiCompletionProvider provider = aiProviderRouter.getProvider(
                providerName != null ? providerName : "ollama");
        String effectiveModel = model != null ? model : "qwen3:14b";

        log.info("Extracting from meeting={} via provider={} model={}",
                meetingId, provider.name(), effectiveModel);

        AiCompletion completion = provider.chatCompletion(
                EXTRACTION_SYSTEM_PROMPT,
                userPrompt,
                effectiveModel,
                2048,
                new BigDecimal("0.3")
        );

        return new ExtractionResult(completion.content(), completion.provider(),
                completion.model(), completion.totalTokens());
    }

    public record ExtractionResult(String json, String provider, String model, int tokensUsed) {}
}
