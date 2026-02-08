# DecisionDesk — Scope (MVP-first)
- iOS records → upload (no auto-transcribe) → user triggers transcription.
- Providers: remote_openai (cloud), server_local (backend engine), desktop_local (Mac app processes queue and posts transcript).
- Early clients: iOS and macOS; Web later.
- MVP: polling (no WS), no multitenancy, no chunked upload.
