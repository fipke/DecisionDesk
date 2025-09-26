# DecisionDesk

Multiplatform meeting recorder. **Backend centralizes all AI calls** (clients never call OpenAI).
- MVP: iOS first (record → single upload → backend transcribes with Whisper → show costs), then macOS, then Web.
- Spring Boot 4 / Spring Framework 7 (API versioning recommended)
- Offline-first clients (SQLite), **simple upload** first (no chunked), polling (no WS) in MVP
