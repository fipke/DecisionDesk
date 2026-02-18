# PR02 — Meetings Core ✅

**Scope**: Backend only  
**Status**: Complete — shipped in commit `771d4846` area

## What was built

### API
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/meetings` | Create meeting, returns `{ id, status: "NEW" }` |
| `POST` | `/api/v1/meetings/{id}/audio` | Upload audio file (store-only; never auto-transcribes) |
| `POST` | `/api/v1/meetings/{id}/transcribe` | Manually trigger Whisper transcription |
| `GET` | `/api/v1/meetings/{id}` | Get meeting details: status, transcript, cost breakdown |
| `PATCH` | `/api/v1/meetings/{id}/title` | Update meeting title |

### Rules
- `AUTO_TRANSCRIBE_ON_UPLOAD` env var **must remain `false`**. Upload returns `{ status: "NEW" }` only.
- Transcription is a separate manual step (ensures user controls when credits are spent).
- Cost is computed on the backend using `WhisperCostCalculator`: minutes × rate → USD and BRL.

### Data model
```
meetings
  id            UUID PK
  status        NEW | PROCESSING | DONE | ERROR
  audio_path    TEXT
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ

transcripts
  id            UUID PK
  meeting_id    UUID FK
  language      TEXT
  text          TEXT
  duration_secs NUMERIC

costs
  id            UUID PK
  meeting_id    UUID FK
  whisper_mins  NUMERIC
  whisper_usd   NUMERIC
  whisper_brl   NUMERIC
```

### Key classes
- `MeetingsController` — REST entry point
- `MeetingService` — orchestrates upload, transcription, cost
- `AudioStorageService` — stores audio outside webroot
- `WhisperCostCalculator` / `MeetingCostAggregator` — cost computation
