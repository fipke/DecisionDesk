# Roadmap

## Status Overview

| PR | Title | Status | Platforms |
|----|-------|--------|-----------|
| PR01 | Backend bootstrap — Health, DB, Costs, OpenAI config | ✅ Done | Backend |
| PR02 | Meetings — upload, store, manual transcribe, cost | ✅ Done | Backend |
| PR03 | iOS v1 — record, upload, transcribe, view transcript | ✅ Done | Mobile |
| PR04 | macOS v1 — meeting list, queue UI (disabled) | ✅ Done | Desktop |
| PR05 | Desktop queue — persistent jobs, retry, timeout | ✅ Done | Backend + Desktop |
| PR06 | Desktop transcription — whisper.cpp + diarization | ✅ Done | Backend + Desktop |
| PR07 | Organisation — folders, meeting types, tags | ✅ Done | Backend + Mobile |
| PR08 | People — participants, @mentions | ✅ Done | Backend + Mobile |
| PR09 | AI Summaries — GPT-4, templates | ✅ Done | Backend + Mobile |
| PR-Notes | Notes system — agenda/live/post, series, import | ✅ Done | Backend |
| PR-Offline | Desktop offline-first — SQLite, outbox sync | ✅ Done | Desktop |
| PR10 | Web v1 — dashboard, meetings, notes | 🚧 In Progress | Web |
| PR11 | Chunked upload, WebSockets live progress | 🚧 Planned | Backend + All |
| PR12 | Budget tracking and cost alerts | 📋 Planned | Backend |
| PR13 | Advanced search and filters | 📋 Planned | Backend + All |
| PR14 | Desktop advanced — live capture, model downloader | 📋 Planned | Desktop |

---

## Completed PRs

### PR01 — Backend Bootstrap
- Spring Boot, Java 21, PostgreSQL, Flyway
- Health endpoint, OpenAI config, Whisper cost model (USD + BRL)
- V1 baseline migration

### PR02 — Meetings Core
- `POST /api/v1/meetings` + audio upload (store-only, never auto-transcribes)
- `POST /api/v1/meetings/{id}/transcribe` — manual trigger
- `GET /api/v1/meetings/{id}` — details with transcript + cost
- Whisper cost aggregation (minutes × rate → USD + BRL)

### PR03 — iOS v1
- React Native (Expo) AAC recording, SQLite offline cache, outbox sync queue
- Record → upload → manual "Transcrever agora" → transcript + cost view
- Folder/type/tag organising, people mentions, summary display

### PR04 — macOS v1 (Desktop shell)
- Electron app skeleton: meeting list, details, costs
- Queue tab present but greyed out (activated in PR05/06)

### PR05 — Desktop Queue (Persistent)
- `transcription_queue` PostgreSQL table with full state machine
- `DesktopQueueController`: accept, poll, result submission
- `PersistentDesktopQueueService`: `@Scheduled` retry (5 min), timeout (10 min), daily cleanup, hourly stats

### PR06 — Desktop Transcription Engine
- `WhisperService`: spawns `whisper-cli` with Metal GPU, configurable model
- `QueueService`: poll → accept → download audio → transcribe → diarize → submit
- `diarize.py`: pyannote-audio speaker diarization with HF token, MPS support
- Settings UI: model selector, diarization toggle, API URL

### PR07 — Organisation
- Folders (hierarchical path), Meeting Types, Tags (JSON key-value)
- `V2__folders_types_tags.sql`, full CRUD API + mobile integration

### PR08 — People
- `Person` entity: displayName, fullName, email, notes
- `MeetingPerson` join table with role (participant / mentioned)
- `V3__people.sql`, REST API, mobile screen + @mention input

### PR09 — AI Summaries
- GPT-4o summaries with `SummaryTemplate` library
- `V4__summary_templates.sql`, configurable prompt styles (brief, detailed, action-focused)
- `SummaryService` + `SummaryTemplatesController`

### PR-Notes — Meeting Notes System
- `V5__notes_continuity.sql`: agenda, live, post notes + continuity links
- Structured block types: heading, paragraph, action_item, decision, question, reference
- Meeting series (recurring), previous-meeting context, GPT context formatting
- Transcript import: Teams/Zoom `.vtt`, `.txt`, raw text
- `MeetingNotesController`, `MeetingSeriesController`, `TranscriptImportController`, `UserPreferencesController`

### PR-Offline — Desktop Offline-First
- `better-sqlite3` local database (WAL mode, 10 migrations, 15 tables)
- Full entity persistence: meetings, folders, types, people, note blocks, summaries, series, templates
- Outbox sync pattern (`sync_queue` table): mutations enqueued locally, drained FIFO when backend reachable
- `ConnectivityService`: online/offline detection with `net.fetch` health check every 15 s
- `SyncService`: auto-drain on `backend-reachable` event, max 5 retries per item
- IPC bridge: 40+ handlers across `db.*` and `connectivity.*` renderer namespaces
- Sidebar: connectivity indicator (green/amber/red) + pending sync badge

---

## In Progress / Planned

### PR10 — Web v1
- React dashboard (`apps/web`)
- Meeting list, details, notes editor, folder tree, people management
- Reuse `packages/types` and `packages/utils`

### PR11 — Chunked Upload + WebSockets
- Resumable multipart audio upload (large files)
- WebSocket events for live transcription progress

### PR12 — Budget Tracking
- Monthly cost targets per folder/workspace
- Alert thresholds, usage graphs

### PR13 — Advanced Search
- Full-text search on transcripts and notes
- Filter by folder, type, date range, people, tags

### PR14 — Desktop Advanced Features
- Live microphone + system audio capture
- In-app Whisper model downloader
- Real-time captions overlay


---

## PR 05 + 06 — Desktop Local Transcription (✅ Completed)

### Implemented Features

#### Backend (PR05)
- ✅ **Persistent Queue**: PostgreSQL-backed transcription_queue table
- ✅ **DesktopQueueController**: REST API for queue management
- ✅ **Automatic Retry**: Failed jobs retried up to 3 times (configurable)
- ✅ **Timeout Detection**: Stalled jobs marked as failed after 30 min
- ✅ **Background Cleanup**: Old completed/cancelled jobs purged after 24h
- ✅ **Job Monitoring**: Queue statistics logged hourly

#### Desktop App (PR06)
- ✅ **WhisperService**: Integration with whisper.cpp via spawn
- ✅ **QueueService**: Poll, accept, download, process, submit workflow
- ✅ **Pyannote Integration**: Speaker diarization with diarize.py script
- ✅ **Settin Status
- [x] Configurable model selection
- [x] Post-recording batch processing
- [x] Speaker identification (pyannote-audio)
- [x] Backend sync (POST transcripts)
- [x] Persistent queue with retry logic
- [ ] Live streaming transcription
- [ ] Real-time captions overlay
- [ ] Transcript export (SRT, VTT, TXT, JSON)
- [ ] Audio capture (mic + system audio)
- [ ] In-app model downloader

### Database Schema

**transcription_queue table:**
- `id`, `meeting_id`, `audio_path`, `model`, `language`
- `enable_diarization`, `status`, `retry_count`
- `accepted_at`, `completed_at`, `error_message`
- Indexes on `status`, `meeting_id`, `created_at`

### API Endpoints

```
GET    /api/v1/desktop/queue                    # List pending jobs
POST   /api/v1/desktop/queue/{id}/accept        # Accept job
GET    /api/v1/desktop/queue/{id}/audio         # Download audio
POST   /api/v1/desktop/queue/{id}/result        # Submit result
```

### Configuration

```yaml
transcription:
  desktop:
    enabled: true
    job-timeout-minutes: 30      # Timeout for stalled jobs
    max-retries: 3                # Max retry attempts
    cleanup-retention-hours: 24   # Cleanup completed jobs
    retry-check-minutes: 5        # Check interval for retries
    timeout-check-minutes: 10     # Check interval for timeouts
```ate-of-the-art)
- **Platform**: macOS (Apple Silicon optimized)

### Model Selection (User Configurable)
| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| large-v3 | 4GB | ~15x realtime | Best | Default for all |
| medium | 2GB | ~30x realtime | Great | Battery saving |
| small | 1GB | ~45x realtime | Good | Quick previews |
| base | 142MB | ~100x realtime | Acceptable | Lowest resource |

### Features
- [x] Configurable model selection
- [ ] Live streaming transcription
- [ ] Post-recording batch processing
- [ ] Speaker identification (pyannote)
- [ ] Real-time captions overlay
- [ ] Transcript export (SRT, VTT, TXT, JSON)

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    DESKTOP APP (macOS)                      │
├─────────────────────────────────────────────────────────────┤
│  Audio Input                                                │
│  ├── Microphone capture                                     │
│  ├── System audio (meetings: Zoom, Teams, etc.)             │
│  └── File import (wav, mp3, m4a)                            │
├─────────────────────────────────────────────────────────────┤
│  Processing Pipeline                                        │
│  ├── whisper.cpp + Metal GPU                                │
│  │   └── Model: user-selected (default: large-v3)          │
│  ├── pyannote-audio                                         │
│  │   └── Speaker diarization                                │
│  └── Output: timestamped transcript with speakers           │
├─────────────────────────────────────────────────────────────┤
│  Sync                                                       │
│  └── POST transcript to backend API                         │
└─────────────────────────────────────────────────────────────┘
```
