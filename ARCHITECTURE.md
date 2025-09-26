## DecisionDesk — Architecture (MVP-first)
Clients: RN iOS first, then Electron macOS, then Web (React/Vite). All with SQLite (offline-first).
Backend: Spring Boot 4 / Spring 7 (API versioning), PostgreSQL.
AI: **All OpenAI (Whisper/GPT) calls are performed by the backend only.**
MVP: No multitenancy, no queues, no WebSockets, no chunked uploads.
Storage: audio saved to local volume (container); abstract later for S3.
Transcription: backend calls Whisper after upload (synchronous). Costs recorded server-side.
