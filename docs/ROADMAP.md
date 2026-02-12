# Roadmap

## Completed
- PR 01 — Backend bootstrap + Health + DB + OpenAI config + Costs base
- PR 02 — Meetings + Upload (store only) + Manual /transcribe (cloud); GET details
- PR 03 — iOS v1 (record → upload → tap "Transcribe" → see transcript/cost)

## In Progress
- PR 04 — macOS v1 (queue-aware UI, disabled initially)

## Planned
- PR 05 — Desktop-local queue (manual accept on Mac)
- PR 06 — Desktop-local transcription engine (see LOCAL-TRANSCRIBE.md)
- PR 07 — GPT summary (cloud) + costs
- PR 08 — Web v1
- PR 09 — Chunked upload, WebSockets, server-local provider, presets/importers, budget

---

## PR 06 — Desktop Local Transcription (Expanded)

### Core Stack
- **Transcription Engine**: whisper.cpp with Metal GPU acceleration
- **Speaker Diarization**: pyannote-audio (state-of-the-art)
- **Platform**: macOS (Apple Silicon optimized)

### Model Selection (User Configurable)
| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| large-v3 | 4GB | ~15x realtime | Best | Default for all |
| medium | 2GB | ~30x realtime | Great | Battery saving |
| small | 1GB | ~45x realtime | Good | Quick previews |
| base | 142MB | ~100x realtime | Acceptable | Lowest resource |

### Features
- [x] Configurable model selection
- [ ] Live streaming transcription
- [ ] Post-recording batch processing
- [ ] Speaker identification (pyannote)
- [ ] Real-time captions overlay
- [ ] Transcript export (SRT, VTT, TXT, JSON)

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    DESKTOP APP (macOS)                      │
├─────────────────────────────────────────────────────────────┤
│  Audio Input                                                │
│  ├── Microphone capture                                     │
│  ├── System audio (meetings: Zoom, Teams, etc.)             │
│  └── File import (wav, mp3, m4a)                            │
├─────────────────────────────────────────────────────────────┤
│  Processing Pipeline                                        │
│  ├── whisper.cpp + Metal GPU                                │
│  │   └── Model: user-selected (default: large-v3)          │
│  ├── pyannote-audio                                         │
│  │   └── Speaker diarization                                │
│  └── Output: timestamped transcript with speakers           │
├─────────────────────────────────────────────────────────────┤
│  Sync                                                       │
│  └── POST transcript to backend API                         │
└─────────────────────────────────────────────────────────────┘
```
