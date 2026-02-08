package com.decisiondesk.backend.meetings.persistence;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.postgresql.util.PGobject;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.decisiondesk.backend.meetings.model.UsageRecord;
import com.decisiondesk.backend.meetings.model.UsageRecord.Service;

/**
 * Repository for persisting usage and billing information.
 */
@Repository
public class UsageRecordRepository {

    private final JdbcClient jdbcClient;

    public UsageRecordRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void insert(UsageRecord record) {
        PGobject jsonb = new PGobject();
        try {
            jsonb.setType("jsonb");
            jsonb.setValue(record.meta());
        } catch (SQLException ex) {
            throw new IllegalStateException("Unable to map usage metadata", ex);
        }

        jdbcClient.sql("""
                INSERT INTO usage_records (id, meeting_id, service, units, usd, brl, meta)
                VALUES (:id, :meetingId, :service, :units, :usd, :brl, :meta)
                """)
                .param("id", record.id())
                .param("meetingId", record.meetingId())
                .param("service", record.service().name())
                .param("units", record.units())
                .param("usd", record.usd())
                .param("brl", record.brl())
                .param("meta", jsonb)
                .update();
    }

    public List<UsageRecord> findByMeetingId(UUID meetingId) {
        return jdbcClient.sql("SELECT id, meeting_id, service, units, usd, brl, meta::text AS meta, created_at FROM usage_records WHERE meeting_id = :meetingId")
                .param("meetingId", meetingId)
                .query(this::mapUsageRecord)
                .list();
    }

    private UsageRecord mapUsageRecord(ResultSet rs, int rowNum) throws SQLException {
        return new UsageRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("meeting_id", UUID.class),
                Service.valueOf(rs.getString("service")),
                rs.getBigDecimal("units"),
                rs.getBigDecimal("usd"),
                rs.getBigDecimal("brl"),
                rs.getString("meta"),
                rs.getObject("created_at", OffsetDateTime.class));
    }
}
