# Spec Load List (authoritative)

Read these in this exact order before executing any task:

1. `docs/SPEC-MASTER.md` — product pillars, architecture, implementation rules
2. `docs/ROADMAP.md` — PR status and what's planned
3. `docs/API-SURFACE.md` — all REST endpoints
4. `docs/DB-SCHEMA.md` — PostgreSQL schema (Flyway V1–V6)
5. `docs/DB-SCHEMA-LOCAL.md` — SQLite schema (iOS + desktop offline)
6. `docs/ENV.md` — all environment variables
7. `docs/SECURITY.md` — security policies
8. `docs/ERRORS.md` — error codes
9. `docs/LOCAL-TRANSCRIBE.md` — Whisper providers, models, diarization
10. `docs/SCOPE.md` — MVP boundaries and deferrals

Then read per-PR spec files as needed (`docs/specs/`):

| File | Covers |
|------|--------|
| `specs/PR00-SPEC-FIXUP.md` | How to handle spec drift |
| `specs/PR02-PATCH.md` | Meetings CRUD, audio upload, transcription, costs |
| `specs/PR03-SPEC.md` | Mobile app (React Native / Expo) |
| `specs/PR04-SPEC.md` | Desktop app (Electron, IPC, whisper.cpp) |
| `specs/PR05-SPEC.md` | Persistent queue, desktop-local provider |
| `specs/PR06-SPEC.md` | Desktop transcription engine, diarization |
| `specs/PR07-SPEC.md` | Folders + Meeting Types (V2 migration) |
| `specs/PR08-SPEC.md` | People, participants, @mentions (V3 migration) |
| `specs/PR09-SPEC.md` | Summary templates + GPT-4 integration (V4 migration) |
| `specs/PR-Notes-SPEC.md` | Meeting notes, continuity, series, import (V5 migration) |
| `specs/PR-Offline-SPEC.md` | Desktop offline-first SQLite layer |

Reference docs (useful but not required reading every time):

- `docs/CURL-RECIPES.md` — quick curl commands for manual testing
- `docs/CHECKLISTS/PR-CHECKLIST.md` — pre-merge checklist
- `docs/CHECKLISTS/ENDPOINT-CHECKLIST.md` — per-endpoint quality gates
