package com.decisiondesk.backend.meetings.model;

import java.math.BigDecimal;

/**
 * Structured cost information included in meeting details responses.
 */
public record MeetingCostBreakdown(WhisperCost whisper, GptCost gpt, TotalCost total) {

    public MeetingCostBreakdown {
        whisper = whisper == null ? WhisperCost.EMPTY : whisper;
        total = total == null ? TotalCost.EMPTY : total;
    }

    /**
     * Whisper-specific usage information.
     */
    public record WhisperCost(BigDecimal minutes, BigDecimal usd, BigDecimal brl) {
        private static final WhisperCost EMPTY = new WhisperCost(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);

        public WhisperCost {
            minutes = minutes == null ? BigDecimal.ZERO : minutes;
            usd = usd == null ? BigDecimal.ZERO : usd;
            brl = brl == null ? BigDecimal.ZERO : brl;
        }
    }

    /**
     * GPT-specific usage information (not populated in PR02, reserved for future PRs).
     */
    public record GptCost(Long promptTokens, Long completionTokens, BigDecimal usd, BigDecimal brl) {
    }

    /**
     * Aggregated totals across all AI services.
     */
    public record TotalCost(BigDecimal usd, BigDecimal brl) {
        private static final TotalCost EMPTY = new TotalCost(BigDecimal.ZERO, BigDecimal.ZERO);

        public TotalCost {
            usd = usd == null ? BigDecimal.ZERO : usd;
            brl = brl == null ? BigDecimal.ZERO : brl;
        }
    }
}
