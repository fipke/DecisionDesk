# SPEC-MASTER — Canonical Product & Tech Requirements (v20250929)

This file is **the single source of truth**. If code diverges, raise **PR 00 — Spec Fixup**.

## Product pillars
- **Platforms**: iOS (React Native), macOS (Electron), Web (React, later).
- **Priority**: iOS first, macOS second, Web third.
- **Modern UI**: dark mode by default; clean, rounded cards; Tailwind/NativeWind; accessible; PT‑BR strings by default.
- **Meeting model**: Folders + tags; default summaries, frequent participants, checklist of pendências; prompts library (post-MVP).
- **Flow (MVP)**: record on iOS → upload to backend → **manual** `/transcribe` → server computes costs → render transcript & costs.
- **Language**: default **Português (Brasil)**; allow EN/DE choice in UI (backend default stays `pt` in MVP).
- **Offline-first**: local SQLite on iOS/macOS; retain recordings & transcripts; sync when online.
- **Network policy**: Wi‑Fi default, cellular **opt‑in** with data usage warning.
- **Costs**: server computes Whisper minutes and (later) GPT tokens; prices and FX in ENV; totals by meeting/prompt later.
- **Security**: backend-only OpenAI; validate uploads; store audio outside webroot; rate-limit; later: server-local models; no E2EE (needs search).

## Architecture
- **Backend**: Spring Boot 4 / Spring Framework 7 (API versioning), Java 21; Postgres + Flyway; OpenAPI; WebSockets later.
- **Transcription providers** (pluggable): 
  - `remote_openai` (default MVP)
  - `server_local` (faster-whisper/whisper.cpp)
  - `desktop_local` (Electron runs whisper.cpp; manual accept queue)
- **Manual transcribe policy**: Upload **never** auto-transcribes (`AUTO_TRANSCRIBE_ON_UPLOAD=false`). `/transcribe` is the trigger.
- **Queue (desktop-local)**: jobs are enqueued; user **accepts** on Mac to start; then Mac posts transcript back.
- **DB**: Postgres (JSONB where useful), schema per docs; future multi-tenant by schema (post-MVP).

## Implementation rules
- **Coding standards**: Javadoc/JSDoc required; shared utils; no duplication; CHANGELOG + Conventional Commits + changesets.
- **Files & structure**: monorepo `apps/{backend,mobile,desktop,web}` + `packages/{utils,types,prompts}`.
- **iOS audio**: AAC m4a, 48 kHz, mono, ~96 kbps.
- **Storage**: local volumes via backend (object store later). Retain audio server-side 6 months; prompt before deletion; iOS may auto-clean after 3 months if storage is low.
- **Import/export** (later): import DOCX/VTT/SRT; export MD/PDF/DOCX.
- **KPIs** (later): pendências abertas/fechadas, tempo por tópico, participação, custo por reunião/pasta/mês.

## Conformance
- If any feature/code conflicts with this spec, open **PR 00 — Spec Fixup** and reconcile (update code and docs).
- All per-PR specs must **inherit** these rules.
