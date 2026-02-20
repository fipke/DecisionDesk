# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DecisionDesk** is a multiplatform meeting recorder. The backend centralizes all AI calls (OpenAI Whisper/GPT). Three transcription providers: `remote_openai`, `server_local`, `desktop_local` (whisper.cpp on macOS).

**Core rules (non-negotiable)**:
- Clients (iOS/macOS/Web) **NEVER call OpenAI directly** — all Whisper/GPT happens in the backend.
- Upload does **not** auto-transcribe. Transcription is a manual action: `POST /api/v1/meetings/{id}/transcribe` or via desktop-local queue.
- MVP: polling only (no WebSockets), no multitenancy, no chunked upload.
- Dark mode default on clients; Tailwind (Web/Electron), NativeWind (React Native).
- No duplicated utilities — centralize in `packages/utils`.
- Document public code (Javadoc/JSDoc). Conventional Commits + one changeset per PR.

## Monorepo Structure

```
apps/backend/     Spring Boot 4 / Java 21 / PostgreSQL 16
apps/mobile/      React Native 0.81 + Expo SDK 54 / SQLite
apps/desktop/     Electron 33 + React 19 / SQLite (better-sqlite3)
apps/web/         React + Vite (PR10, in progress)
packages/types/   Shared TypeScript types + JSON schemas
packages/utils/   Centralized utility functions
packages/prompts/ Shared AI prompt templates
```

Orchestrated with Turborepo (`turbo.json`). Shared TypeScript base in `tsconfig.base.json` (ES2022, strict, bundler resolution).

## Commands

### Root (Makefile + Turbo)
```bash
make help           # List all Makefile targets
make setup          # One-time: init DB + backend env file
make db-start       # Start PostgreSQL on port 5435
make db-stop        # Stop PostgreSQL
make backend-run    # Start Spring Boot API
make backend-test   # Run backend tests
make mobile-install # Install mobile deps
make mobile-run     # Start iOS simulator
make clean          # Stop all services

turbo build         # Build all packages (dep-order)
turbo lint          # Lint all packages
turbo test          # Test all packages
```

### Backend (`apps/backend`)
```bash
mvn spring-boot:run         # Start API server
mvn test                    # Run all tests
mvn -Dtest=ClassName test   # Run a single test class
mvn clean package -DskipTests
mvn flyway:info             # Check migration status
```

### Mobile (`apps/mobile`)
```bash
npm install
npm start               # Expo dev server
npx expo start --ios    # Open iOS simulator
npm test                # Jest
npx tsc --noEmit        # Type check
```

### Desktop (`apps/desktop`)
```bash
npm run dev             # Electron dev mode
npm run build           # Production build
npm run build:mac       # macOS DMG
npm run build:mac:arm64 # Apple Silicon DMG
npm run typecheck       # TypeScript check
npm run lint            # ESLint
npm test                # Jest
```

## Architecture

### Backend Packages (Java)
- `api/v1/` — REST controllers (API versioning via Spring Framework 7)
- `meetings/` — Core domain (model, repository, service)
- `cost/` — Whisper cost calculator (USD + BRL)
- `openai/` — OpenAI API client (Whisper + GPT-4o)
- `notes/` — Meeting notes with blocks (agenda/live/post)
- `people/` — Participants + @mentions
- `organization/` — Folders, meeting types, tags
- `summaries/` — GPT-4o summaries with configurable templates
- `desktop/` — Desktop transcription queue management

### Database (PostgreSQL — Flyway migrations)
| Migration | Content |
|-----------|---------|
| V1 | Meetings, audio storage, transcriptions, costs |
| V2 | Organization: folders, types, tags |
| V3 | People / participants |
| V4 | Summary templates |
| V5 | Notes continuity and blocks |
| V6 | Desktop transcription job queue |

### Desktop SQLite (offline-first)
- WAL mode, 10+ migrations, 15 tables
- Outbox sync pattern for mutations; auto-sync on reconnect, 5 retries
- 40+ IPC handlers bridging Electron main ↔ renderer via preload

### Desktop Queue (PR05/06)
- Mac polls backend every 10 s for `desktop_local` jobs
- Persistent state machine: `pending → processing → done/failed`
- Retry interval: 5 min; timeout: 10 min; daily cleanup + hourly stats

## Key Docs to Read Before Coding

```
docs/SPEC-LOADLIST.md           (reading order)
docs/SPEC-MASTER.md             (product pillars, architecture)
docs/ROADMAP.md
docs/API-SURFACE.md
docs/DB-SCHEMA.md
docs/DB-SCHEMA-LOCAL.md
docs/ENV.md
docs/ERRORS.md
docs/SECURITY.md
docs/LOCAL-TRANSCRIBE.md
docs/specs/ARCHIVE-COMPLETED.md (all completed PR summaries)
```

## Git / Commits

- **NEVER add Co-Authored-By lines** to commits, files, or any content.
- Conventional Commits style: `type(scope): message`.

## Environment

PostgreSQL via Docker Compose (port 5435, user/pass/db: `decisiondesk`). Backend needs `.env` — copy from `.env.example` and fill `OPENAI_API_KEY`. See `docs/ENV.md` for all variables.
