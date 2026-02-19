package com.decisiondesk.backend.api.v1.meetings;

import java.math.BigDecimal;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.decisiondesk.backend.ai.AiCompletion;
import com.decisiondesk.backend.ai.AiCompletionProvider;
import com.decisiondesk.backend.ai.AiProviderRouter;
import com.decisiondesk.backend.meetings.persistence.TranscriptRepository;
import com.decisiondesk.backend.web.ApiException;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Chat with a meeting's transcript using AI.
 */
@RestController
@RequestMapping(path = "/api/v1/meetings/{meetingId}/chat", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Meeting Chat", description = "Chat with meeting transcript via AI")
public class MeetingChatController {

    private static final String CHAT_SYSTEM_PROMPT = """
            You are a helpful meeting assistant. You have access to the full transcript of a meeting.
            Answer the user's questions based on what was discussed in the meeting.
            Always respond in the same language as the transcript.
            Be concise and precise. If something was not discussed, say so.

            Meeting transcript:
            %s
            """;

    private final AiProviderRouter aiProviderRouter;
    private final TranscriptRepository transcriptRepository;

    public MeetingChatController(AiProviderRouter aiProviderRouter,
                                  TranscriptRepository transcriptRepository) {
        this.aiProviderRouter = aiProviderRouter;
        this.transcriptRepository = transcriptRepository;
    }

    @PostMapping
    @Operation(summary = "Chat with meeting transcript",
               description = "Send a message and get an AI-generated response based on the meeting transcript")
    public ChatResponse chat(@PathVariable UUID meetingId, @RequestBody ChatRequest request) {
        String transcriptText = transcriptRepository.findByMeetingId(meetingId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,
                        "NO_TRANSCRIPT", "Meeting has no transcript"))
                .text();

        String systemPrompt = String.format(CHAT_SYSTEM_PROMPT, transcriptText);
        AiCompletionProvider provider = aiProviderRouter.getProvider(
                request.provider() != null ? request.provider() : "ollama");
        String model = request.model() != null ? request.model() : "qwen2.5:14b";

        AiCompletion completion = provider.chatCompletion(
                systemPrompt,
                request.message(),
                model,
                1024,
                new BigDecimal("0.5")
        );

        return new ChatResponse(completion.content(), completion.provider(),
                completion.model(), completion.totalTokens());
    }

    public record ChatRequest(String message, String provider, String model) {}
    public record ChatResponse(String answer, String provider, String model, int tokensUsed) {}
}
