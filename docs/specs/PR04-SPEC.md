# PR04 — macOS Desktop v1 (Shell) ✅

**Scope**: Desktop (Electron)  
**Status**: Complete — shell with queue UI placeholder; full offline-first added in PR-Offline

## What was built

### App shell
- Electron 33 + React 19 + Tailwind, dark mode, `hiddenInset` titlebar
- Single instance lock (focuses existing window on re-launch)
- `electron-store` for lightweight settings persistence (API URL, preferences)
- Hash-based routing: `/` (Queue) and `/settings`

### Screens
| Screen | Description |
|--------|-------------|
| `QueueScreen` | Lists pending transcription jobs from backend; Accept / Process controls |
| `SettingsScreen` | API URL, Whisper model, diarization toggle, auto-accept, notifications |

### Services wired in this PR
- `WhisperService` — detects `whisper-cli` binary and available models
- `QueueService` — polls backend queue every 10 s (activated but queue was empty until PR05)
- `ApiService` — axios wrapper around the backend REST API

### IPC namespaces (preload bridge)
- `settings.*` — get / set key-value store
- `queue.*` — getPending, acceptJob, processJob; event listeners for job lifecycle
- `whisper.*` — getStatus, transcribe
- `api.*` — setUrl

### What was deliberately deferred
- Queue backend persistence → PR05
- Whisper local execution → PR06
- Full offline SQLite → PR-Offline

## Expanded in later PRs
| PR | Addition |
|----|---------|
| PR05 | Backend persistent queue, `DesktopQueueController` |
| PR06 | `whisper.cpp` execution, pyannote diarization |
| PR-Offline | `better-sqlite3` local DB, repositories, connectivity monitor, outbox sync, 40+ IPC handlers |
