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
| PR10 | UX Redesign — dashboard, Ollama, multi-summary, 3-panel layout | ✅ Done | All |
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

### PR10 — UX Redesign (Modern Feature Upgrade)
- **Backend**: AI provider abstraction (Ollama + OpenAI), AiProviderRouter, per-task model config
- **Backend**: OllamaClient (REST to local server), AiExtractionService, MeetingChatController
- **Backend**: StatsController (dashboard), AiSettingsController, V7+V8 migrations
- **Backend**: Multi-summary per meeting (composite unique on meeting_id + template_id)
- **Backend**: Meeting type enrichment (starter templates with summary_template_ids, extraction_config)
- **Web**: Full React/Vite app — Dashboard, MeetingDetail (3-panel layout), MeetingTypes CRUD, Templates, Settings
- **Web**: Notes editor with auto-save, multi-summary sub-tabs, AI settings with Ollama management
- **Desktop**: Theme toggle, TemplatesScreen, PeopleScreen, RecordScreen, AI settings section
- **Mobile**: Theme toggle, TemplatesScreen, AI provider selection, dark theme across all components

---

## In Progress / Planned

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

## Backlog (Ideas)

### Visual Meeting Summary (inspired by notta.ai)

- LLM (qwen2.5:14b local) extracts structured JSON: key findings, metrics, action items, timeline
- Frontend renders as infographic card using Recharts (charts) + Mermaid.js (diagrams) + Tailwind
- Export to PNG/PDF via html2canvas + jsPDF
- Works with local Ollama, no paid API required
- Libraries: Recharts, Mermaid.js, html2canvas, jsPDF
