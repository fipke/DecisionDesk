---
"backend": minor
---

Implement synchronous audio upload, Whisper transcription, and meeting cost aggregation.

## Highlights
- `POST /api/v1/meetings` creates meetings backed by PostgreSQL.
- `POST /api/v1/meetings/{id}/audio` stores audio and conditionally triggers Whisper based on `AUTO_TRANSCRIBE_ON_UPLOAD`.
- `POST /api/v1/meetings/{id}/transcribe` invokes the synchronous Whisper flow on demand.
- `GET /api/v1/meetings/{id}` exposes status, transcript, and cost breakdown.
