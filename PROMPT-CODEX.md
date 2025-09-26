# DecisionDesk — Codex Master Prompt (MVP-first, Full)

Act as a senior architect. Use the seed docs for full context. Generate code in **small PRs** only.

## Read these first
- docs/SCOPE.md
- docs/ROADMAP.md
- docs/API-SURFACE.md
- docs/DOMAIN-MODEL.md

## Core rules
- MVP-first: iOS record → single upload → **backend** transcribes (Whisper) → show **server-computed costs**.
- Clients MUST NEVER call OpenAI directly. All Whisper/GPT calls happen in the backend.
- Spring Boot 4 / Spring 7 with API versioning. Choose compatible versions yourself.
- Document public code (Javadoc/JSDoc). Conventional Commits + changeset per PR.
- No duplicate utilities—use packages/utils.

## Deliver PRs exactly as ROADMAP
PR 01 — Backend bootstrap + Health + API key + costs base  
PR 02 — Single upload + synchronous transcription + GET status/costs  
PR 03 — iOS v1 (record → upload → see transcript/cost)  
PR 04 — Basic GPT summary (one default prompt)  
PR 05 — macOS v1  
PR 06 — Web v1  
PR 07 — (post-MVP) Chunked upload, Queues, WebSockets, Presets, Importers, Budgeting

Say “context loaded” then generate **only PR 01** when asked.
