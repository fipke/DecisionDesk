# Security

## Principles

- **Backend-only AI**: OpenAI/Whisper API keys never leave the server. Mobile and desktop never call AI APIs directly.
- **Upload validation**: MIME type + size checked before writing to disk. Files stored in `AUDIO_STORAGE_PATH` (outside webroot).
- **Rate limiting**: each endpoint class carries its own limit (see `application.yml.example`). Defaults: upload 10 req/min, transcribe 5 req/min, API 100 req/min.
- **deviceId**: desktop-local queue jobs carry a `device_id` claim. Backend validates it matches the accepted job's device before accepting transcript posts.
- **No auth (MVP)**: authentication is explicitly deferred to post-MVP. All endpoints are currently open. Implement token-based auth (JWT or API key) before any public exposure.
- **No E2EE**: search requires plaintext server-side. E2EE is out-of-scope until post-search.
- **Secrets**: `OPENAI_API_KEY` must never appear in logs, error messages, or responses. Use `@SensitiveData` / log masking.
- **Audio retention**: server-side audio kept 6 months; prompt user before deletion. iOS may auto-clean after 3 months on low storage.

## Post-MVP checklist

- [ ] JWT / API key auth for all endpoints
- [ ] Per-user data isolation (multi-tenant by schema)
- [ ] Audit log for transcript access
- [ ] TLS-only in production
- [ ] CSP / CORS policy for web client
