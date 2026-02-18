# PR06 — Desktop Transcription Engine ✅

**Scope**: Desktop (Electron main process) + Backend  
**Status**: Complete — commit `9627d6ad`; offline-first layer added in PR-Offline

## What was built

### WhisperService (`apps/desktop/src/main/whisper.ts`)
- Spawns `whisper-cli` binary (Homebrew in dev; bundled in release builds)
- Metal GPU acceleration on Apple Silicon
- Configurable model: `large-v3` (default), `medium`, `small`, `base`, `tiny`
- Returns: `{ text, language, durationSeconds, processingTimeMs }`

### QueueService (`apps/desktop/src/main/queue.ts`)
Full pipeline per job:
1. Poll `GET /api/v1/desktop/queue` every 10 s
2. Accept job → `POST .../accept` (locks job in backend)
3. Download audio → `GET .../audio` (streamed to temp dir)
4. Transcribe via `WhisperService`
5. Diarize via `diarize.py` (optional, when `enableDiarization = true`)
6. Submit result → `POST .../result`
7. Fire `onJobCompleted` / `onJobFailed` callbacks → renderer notified via IPC

### Diarization (`resources/scripts/diarize.py`)
- `pyannote-audio` speaker diarization
- Requires Hugging Face token (env var `HF_TOKEN`)
- MPS (Apple Silicon GPU) support
- `merge_with_transcript()` — interleaves speaker labels into Whisper output
- Returns JSON: `[{ speaker, start, end, text }]`

### Settings UI
- Whisper model selector (dropdown)
- Diarization toggle
- API URL input
- Auto-accept jobs toggle
- Desktop notifications toggle

### Model selection guide
| Model | Size | Relative speed | Best for |
|-------|------|---------------|---------|
| `large-v3` | ~3 GB | ~15× realtime | Default — best accuracy |
| `medium` | ~1.5 GB | ~30× realtime | Battery-conscious |
| `small` | ~500 MB | ~45× realtime | Quick previews |
| `base` | ~150 MB | ~100× realtime | Lowest resource use |
| `tiny` | ~80 MB | ~200× realtime | Testing only |

### Build / packaging
- `whisper-cli` binary + models → `resources/whisper/` (bundled via `electron-builder` `extraResources`)
- `diarize.py` → `resources/scripts/`
- Dev: binary resolved from Homebrew (`/opt/homebrew/bin/whisper-cli`), models from `~/.whisper/models`

### What was added in PR-Offline (same desktop app)
See [PR-Offline spec](PR-Offline-SPEC.md):
- `better-sqlite3` local database (all entities persisted offline)
- Outbox sync queue draining to backend when reachable
- `ConnectivityService` + `SyncService`
- 40+ IPC handlers bridging renderer ↔ local DB
