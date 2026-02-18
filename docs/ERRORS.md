# Error Codes

> All errors return `{ "error": "<CODE>", "message": "...", "status": <HTTP> }`.

| Code | HTTP | Meaning |
|------|------|---------|
| `MEETING_NOT_FOUND` | 404 | Meeting UUID does not exist |
| `TRANSCRIPT_NOT_FOUND` | 404 | No transcript for this meeting yet |
| `UPLOAD_TOO_LARGE` | 413 | File exceeds `AUDIO_MAX_BYTES` |
| `AUDIO_FORMAT_UNSUPPORTED` | 415 | MIME type not `audio/*` or `video/*` |
| `AUTO_TRANSCRIBE_DISABLED` | 400 | `AUTO_TRANSCRIBE_ON_UPLOAD=true` is illegal |
| `OPENAI_WHISPER_FAILED` | 502 | Remote transcription call failed |
| `LOCAL_ENGINE_FAILED` | 502 | server_local or desktop_local engine error |
| `JOB_NOT_FOUND` | 404 | Queue job UUID does not exist |
| `JOB_ALREADY_LOCKED` | 409 | Job already accepted by another device |
| `JOB_ALREADY_COMPLETED` | 409 | Job status is terminal; cannot change |
| `FOLDER_NOT_FOUND` | 404 | Folder UUID does not exist |
| `FOLDER_PATH_CONFLICT` | 409 | Folder path already in use |
| `PERSON_NOT_FOUND` | 404 | Person UUID does not exist |
| `TEMPLATE_NOT_FOUND` | 404 | Summary template UUID does not exist |
| `SERIES_NOT_FOUND` | 404 | Meeting series UUID does not exist |
| `SUMMARY_GENERATION_FAILED` | 502 | GPT call failed during summary generation |
| `DB_ERROR` | 500 | Unexpected database error |
