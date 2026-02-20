# Completed PR Specs — Archive

This file consolidates all completed PR specifications. For current system state, refer to:
- API endpoints: `API-SURFACE.md`
- Database schema: `DB-SCHEMA.md` / `DB-SCHEMA-LOCAL.md`
- Progress tracking: `ROADMAP.md`
- Environment: `ENV.md`

---

## PR02: Meetings Core
**Status:** Completed
Backend-only PR that established the foundational meetings API: create meeting, upload audio (store-only, never auto-transcribes), manually trigger Whisper transcription, retrieve meeting details with cost breakdown, and update title. Introduced the `meetings`, `transcripts`, and `costs` tables, along with the `WhisperCostCalculator` for USD/BRL cost computation.
**Now documented in:** API-SURFACE.md, DB-SCHEMA.md, ENV.md

---

## PR03: iOS v1
**Status:** Completed
First mobile client built with React Native/Expo. Delivers end-to-end recording flow: capture AAC audio, upload to backend, trigger transcription manually, and poll for results. Includes offline-first SQLite storage with outbox sync, folder-organized meeting list, and a Settings screen for API URL, transcription provider, and Wi-Fi/cellular policy.
**Now documented in:** DB-SCHEMA-LOCAL.md, ROADMAP.md

---

## PR04: macOS Desktop v1 (Shell)
**Status:** Completed
Electron 33 + React 19 app shell with dark mode, `hiddenInset` titlebar, and single-instance lock. Wired `WhisperService` (binary detection), `QueueService` (10 s polling), and `ApiService`. Provided Queue and Settings screens with IPC namespaces for settings, queue, whisper, and API operations. Full offline-first layer and local transcription were deferred to later PRs.
**Now documented in:** ROADMAP.md, ENV.md

---

## PR05: Desktop Queue (Persistent)
**Status:** Completed
Backend persistence for the desktop transcription queue via migration `V6__transcription_queue.sql`. Added `DesktopQueueController` with endpoints to list pending jobs, accept/lock a job, stream audio, and submit results. Introduced four scheduled background jobs: retry failed jobs (5 min), timeout stalled jobs (10 min), daily cleanup, and hourly stats logging — all intervals configurable in `application.yml`.
**Now documented in:** API-SURFACE.md, DB-SCHEMA.md, ENV.md, QUEUE.md

---

## PR06: Desktop Transcription Engine
**Status:** Completed
Local `whisper.cpp` execution in Electron main process with Metal GPU acceleration on Apple Silicon. Full job pipeline: poll queue, accept, download audio, transcribe via `whisper-cli`, optionally diarize via `pyannote-audio` (`diarize.py`), and submit results back to backend. Supports configurable model selection from `large-v3` down to `tiny`, with build/packaging via `electron-builder` `extraResources`.
**Now documented in:** LOCAL-TRANSCRIBE.md, QUEUE.md, ENV.md

---

## PR07: Organisation (Folders, Types, Tags)
**Status:** Completed
Backend + Mobile PR adding organizational taxonomy. Created `folders` (with hierarchical paths and a seeded root `/`), `meeting_types`, and JSONB `tags` on meetings via migration `V2__folders_types_tags.sql`. Added full CRUD controllers for folders and meeting types, plus a `PATCH /meetings/{id}` endpoint accepting folder, type, tags, and title. Mobile integration includes folder-grouped meeting list, folder/type pickers, and tag chips.
**Now documented in:** API-SURFACE.md, DB-SCHEMA.md, DB-SCHEMA-LOCAL.md

---

## PR08: People (Participants & Mentions)
**Status:** Completed
Backend + Mobile PR for participant management. Created `people` and `meeting_people` (composite PK with role) tables via migration `V3__people.sql`. Added CRUD endpoints for people and meeting-person associations with role support (`participant` / `mentioned`). Mobile integration includes @mention input on meeting detail, participant list with role badges, and outbox-synced people data.
**Now documented in:** API-SURFACE.md, DB-SCHEMA.md, DB-SCHEMA-LOCAL.md

---

## PR09: AI Summaries + Templates
**Status:** Completed
Backend + Mobile PR for GPT-4o-powered meeting summaries. Created `summary_templates` and `meeting_summaries` tables via migration `V4__summary_templates.sql`. Added full CRUD for templates plus generate/list endpoints for per-meeting summaries. Three default templates seeded (brief, detailed, action-focused). `SummaryService` builds prompts from template + transcript; all OpenAI calls remain backend-only. Mobile shows a summary tab with template picker.
**Now documented in:** API-SURFACE.md, DB-SCHEMA.md, DB-SCHEMA-LOCAL.md, ENV.md

---

## PR-Notes: Meeting Notes System
**Status:** Completed
Backend PR delivering structured block-based notes (`meeting_notes`) with six block types (heading, paragraph, action_item, decision, question, reference) across three phases (agenda, live, post) via migration `V5__notes_continuity.sql`. Added meeting continuity linking, meeting series with iCal RRULE support, transcript import from Teams/Zoom files (`.vtt`, `.txt`, `.docx`), user preferences, and a GPT context endpoint for prompt enrichment. Enables recurring meeting workflows where unresolved action items carry forward automatically.
**Now documented in:** API-SURFACE.md, DB-SCHEMA.md

---

## PR-Offline: Desktop Offline-First Architecture
**Status:** Completed
Electron desktop PR adding full offline-first capability via `better-sqlite3`. Created 10 SQLite migrations (15 tables mirroring the backend schema) with WAL mode. Built synchronous CRUD repositories for all entities, each auto-enqueuing mutations to an outbox `sync_queue`. Added `ConnectivityService` (health-check polling every 15 s with online/offline/reachable events) and `SyncService` (FIFO drain with 5 retries, last-writer-wins conflict resolution). Wired 40+ `ipcMain.handle` registrations and added connectivity status indicator + pending sync badge to the renderer sidebar.
**Now documented in:** DB-SCHEMA-LOCAL.md, ROADMAP.md, ENV.md
