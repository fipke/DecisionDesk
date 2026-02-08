package com.decisiondesk.backend.meetings;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;

import org.springframework.stereotype.Component;

import com.decisiondesk.backend.meetings.model.MeetingCostBreakdown;
import com.decisiondesk.backend.meetings.model.MeetingCostBreakdown.GptCost;
import com.decisiondesk.backend.meetings.model.MeetingCostBreakdown.TotalCost;
import com.decisiondesk.backend.meetings.model.MeetingCostBreakdown.WhisperCost;
import com.decisiondesk.backend.meetings.model.UsageRecord;
import com.decisiondesk.backend.meetings.model.UsageRecord.Service;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Aggregates usage_records into the cost structure returned by the API.
 */
@Component
public class MeetingCostAggregator {

    private final ObjectMapper objectMapper;

    public MeetingCostAggregator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public MeetingCostBreakdown aggregate(List<UsageRecord> usageRecords) {
        BigDecimal whisperMinutes = BigDecimal.ZERO;
        BigDecimal whisperUsd = BigDecimal.ZERO;
        BigDecimal whisperBrl = BigDecimal.ZERO;

        Long promptTokens = null;
        Long completionTokens = null;
        BigDecimal gptUsd = BigDecimal.ZERO;
        BigDecimal gptBrl = BigDecimal.ZERO;
        boolean hasGpt = false;

        BigDecimal totalUsd = BigDecimal.ZERO;
        BigDecimal totalBrl = BigDecimal.ZERO;

        for (UsageRecord record : usageRecords) {
            totalUsd = totalUsd.add(record.usd());
            totalBrl = totalBrl.add(record.brl());

            if (record.service() == Service.WHISPER) {
                whisperMinutes = whisperMinutes.add(record.units());
                whisperUsd = whisperUsd.add(record.usd());
                whisperBrl = whisperBrl.add(record.brl());
            } else if (record.service() == Service.GPT) {
                hasGpt = true;
                gptUsd = gptUsd.add(record.usd());
                gptBrl = gptBrl.add(record.brl());
                Tokens tokens = extractTokens(record.meta());
                if (tokens.promptTokens() != null) {
                    promptTokens = promptTokens == null ? tokens.promptTokens() : promptTokens + tokens.promptTokens();
                }
                if (tokens.completionTokens() != null) {
                    completionTokens = completionTokens == null ? tokens.completionTokens() : completionTokens + tokens.completionTokens();
                }
            }
        }

        WhisperCost whisperCost = new WhisperCost(whisperMinutes, whisperUsd, whisperBrl);
        GptCost gptCost = hasGpt ? new GptCost(promptTokens, completionTokens, gptUsd, gptBrl) : null;
        TotalCost totalCost = new TotalCost(totalUsd, totalBrl);
        return new MeetingCostBreakdown(whisperCost, gptCost, totalCost);
    }

    private Tokens extractTokens(String meta) {
        if (meta == null || meta.isBlank()) {
            return Tokens.EMPTY;
        }
        try {
            JsonNode node = objectMapper.readTree(meta);
            Long prompt = node.path("promptTokens").isNumber() ? node.get("promptTokens").longValue() : null;
            Long completion = node.path("completionTokens").isNumber() ? node.get("completionTokens").longValue() : null;
            return new Tokens(prompt, completion);
        } catch (IOException ignored) {
            return Tokens.EMPTY;
        }
    }

    private record Tokens(Long promptTokens, Long completionTokens) {
        private static final Tokens EMPTY = new Tokens(null, null);
    }
}
