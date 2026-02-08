package com.decisiondesk.backend.meetings;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.decisiondesk.backend.meetings.model.MeetingCostBreakdown;
import com.decisiondesk.backend.meetings.model.UsageRecord;
import com.decisiondesk.backend.meetings.model.UsageRecord.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

class MeetingCostAggregatorTest {

    private final MeetingCostAggregator aggregator = new MeetingCostAggregator(new ObjectMapper());

    @Test
    void aggregatesWhisperCosts() {
        UsageRecord record = new UsageRecord(
                UUID.randomUUID(),
                UUID.randomUUID(),
                Service.WHISPER,
                new BigDecimal("3"),
                new BigDecimal("0.018"),
                new BigDecimal("0.090"),
                "{\"durationSec\":180}",
                OffsetDateTime.now());

        MeetingCostBreakdown breakdown = aggregator.aggregate(List.of(record));

        assertThat(breakdown.whisper().minutes()).isEqualByComparingTo("3");
        assertThat(breakdown.total().usd()).isEqualByComparingTo("0.018");
        assertThat(breakdown.total().brl()).isEqualByComparingTo("0.090");
    }

    @Test
    void aggregatesGptTokensWhenPresent() {
        UsageRecord whisper = new UsageRecord(
                UUID.randomUUID(),
                UUID.randomUUID(),
                Service.WHISPER,
                BigDecimal.ONE,
                new BigDecimal("0.006"),
                new BigDecimal("0.030"),
                "{}",
                OffsetDateTime.now());
        UsageRecord gpt = new UsageRecord(
                UUID.randomUUID(),
                whisper.meetingId(),
                Service.GPT,
                new BigDecimal("1000"),
                new BigDecimal("0.020"),
                new BigDecimal("0.100"),
                "{\"promptTokens\":700,\"completionTokens\":300}",
                OffsetDateTime.now());

        MeetingCostBreakdown breakdown = aggregator.aggregate(List.of(whisper, gpt));

        assertThat(breakdown.gpt()).isNotNull();
        assertThat(breakdown.gpt().promptTokens()).isEqualTo(700L);
        assertThat(breakdown.gpt().completionTokens()).isEqualTo(300L);
        assertThat(breakdown.total().usd()).isEqualByComparingTo(new BigDecimal("0.026"));
    }
}
