# Spec Load List (authoritative)

Read these in this exact order before executing any task:

1. `docs/SPEC-MASTER.md` — product pillars, architecture, implementation rules
2. `docs/ROADMAP.md` — PR status and what's planned
3. `docs/API-SURFACE.md` — all REST endpoints
4. `docs/DB-SCHEMA.md` — PostgreSQL schema (Flyway V1-V8)
5. `docs/DB-SCHEMA-LOCAL.md` — SQLite schema (iOS + desktop offline)
6. `docs/ENV.md` — all environment variables
7. `docs/SECURITY.md` — security policies
8. `docs/ERRORS.md` — error codes
9. `docs/LOCAL-TRANSCRIBE.md` — Whisper providers, models, diarization

Then read as needed:

| File | Covers |
|------|--------|
| `specs/PR00-SPEC-FIXUP.md` | How to handle spec drift |
| `specs/ARCHIVE-COMPLETED.md` | Summaries of all completed PRs (PR02-PR10) |

Reference docs:

- `docs/CURL-RECIPES.md` — quick curl commands for manual testing
- `docs/CHECKLISTS/PR-CHECKLIST.md` — pre-merge + endpoint checklist
- `docs/plans/` — active planning documents
