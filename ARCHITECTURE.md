## DecisionDesk – High-Level Architecture (Structure-First)

Clients:
- Mobile (iOS): React Native + SQLite (offline-first)
- Desktop (macOS): Electron + React + SQLite
- Web: React (Vite)

Backend:
- Language/Framework: Spring Boot **4.0.0** (recommendation) on Spring Framework **7** to leverage new API versioning features.
- Database: PostgreSQL (multi-tenant ready; strategy to be implemented).
- Messaging: Job queue for transcription/summarization (tool to be selected during implementation).
- Realtime: WebSockets for job progress and cost updates.

Storage:
- Audio initially on local volume (container-mounted). Abstract for future S3.

Notes:
- Keep implementation out of the seed. Add services/modules step-by-step with tests and docs.
- Reference: Spring Boot 4 + Spring Framework 7 API versioning (see vendor docs/baeldung).
