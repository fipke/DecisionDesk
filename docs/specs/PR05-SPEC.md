# PR05 — Desktop Queue (Persistent) ✅

**Scope**: Backend  
**Status**: Complete — commit `9627d6ad`

## What was built

### Database
Migration `V6__transcription_queue.sql`:

```sql
transcription_queue
  id                UUID PK
  meeting_id        UUID NOT NULL
  audio_path        TEXT
  model             TEXT  DEFAULT 'large-v3'
  language          TEXT  DEFAULT 'pt'
  enable_diarization BOOLEAN DEFAULT true
  status            TEXT  -- PENDING | ACCEPTED | PROCESSING | COMPLETED | FAILED | CANCELLED
  retry_count       INT   DEFAULT 0
  accepted_at       TIMESTAMPTZ
  completed_at      TIMESTAMPTZ
  error_message     TEXT
  created_at        TIMESTAMPTZ DEFAULT now()
  updated_at        TIMESTAMPTZ DEFAULT now()
```
Indexes on `status`, `meeting_id`, `created_at`. Auto-update trigger on `updated_at`.

### API — `DesktopQueueController`
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/desktop/queue` | List PENDING jobs for this device |
| `POST` | `/api/v1/desktop/queue/{id}/accept` | Lock job (status → ACCEPTED); returns audio URL |
| `GET` | `/api/v1/desktop/queue/{id}/audio` | Stream audio file to desktop |
| `POST` | `/api/v1/desktop/queue/{id}/result` | Submit transcript result (status → COMPLETED or FAILED) |

### Background jobs — `PersistentDesktopQueueService`
All intervals are configurable via `application.yml`:

| Scheduler | Default | Purpose |
|-----------|---------|---------|
| `retryFailedJobs` | every 5 min | Re-queue FAILED jobs where `retry_count < max_retries` |
| `timeoutStalledJobs` | every 10 min | ACCEPTED/PROCESSING jobs idle > `job-timeout-minutes` → FAILED |
| `cleanupOldJobs` | daily 3 AM | Delete COMPLETED/CANCELLED older than `cleanup-retention-hours` |
| `logQueueStats` | every hour | INFO log of counts by status |

### Configuration
```yaml
transcription:
  desktop:
    enabled: true
    job-timeout-minutes: 30
    max-retries: 3
    cleanup-retention-hours: 24
    retry-check-minutes: 5
    timeout-check-minutes: 10
    cleanup-cron: "0 0 3 * * *"
```

### Key classes
- `TranscriptionQueueJob` — immutable record with state machine methods (`accept()`, `complete()`, `fail()`, `retry()`)
- `TranscriptionQueueRepository` — JDBC queries: `findPending`, `findRetryable`, `findTimedOut`, `deleteCompleted`
- `PersistentDesktopQueueService` — `@Scheduled` orchestration, `@ConditionalOnProperty`
- `DecisionDeskApplication` — `@EnableScheduling` added
