# Roadmap

## Completed
- ✅ PR01 — Backend bootstrap + Health + DB + OpenAI config + Costs base
- ✅ PR02 — Meetings + Upload (store only) + Manual /transcribe (cloud); GET details
- ✅ PR03 — iOS v1 (record → upload → tap "Transcribe" → see transcript/cost)
- ✅ PR04 — macOS v1 (queue-aware UI, disabled initially)
- ✅ PR05 — Desktop-local queue (persistent, retry, timeout)
- ✅ PR06 — Desktop-local transcription (whisper.cpp + pyannote diarization)
- ✅ PR07 — Folders, Types, Tags for organization
- ✅ PR08 — People mentions and GPT summaries
- ✅ PR09 — Summary templates + GPT-4 integration
- ✅ **PR-Notes** — Meeting notes system (agenda/live/post notes, series, continuity, transcript import)

## In Progress
- 🚧 PR10 — Web v1 dashboard
- 🚧 PR11 — Chunked upload, WebSockets

## Planned
- PR12 — Budget tracking and alerts
- PR13 — Advanced search and filters
- PR14 — Advanced desktop features (live transcription, system audio capture, model downloader)

---

## PR 05 + 06 — Desktop Local Transcription (✅ Completed)

### Implemented Features

#### Backend (PR05)
- ✅ **Persistent Queue**: PostgreSQL-backed transcription_queue table
- ✅ **DesktopQueueController**: REST API for queue management
- ✅ **Automatic Retry**: Failed jobs retried up to 3 times (configurable)
- ✅ **Timeout Detection**: Stalled jobs marked as failed after 30 min
- ✅ **Background Cleanup**: Old completed/cancelled jobs purged after 24h
- ✅ **Job Monitoring**: Queue statistics logged hourly

#### Desktop App (PR06)
- ✅ **WhisperService**: Integration with whisper.cpp via spawn
- ✅ **QueueService**: Poll, accept, download, process, submit workflow
- ✅ **Pyannote Integration**: Speaker diarization with diarize.py script
- ✅ **Settin Status
- [x] Configurable model selection
- [x] Post-recording batch processing
- [x] Speaker identification (pyannote-audio)
- [x] Backend sync (POST transcripts)
- [x] Persistent queue with retry logic
- [ ] Live streaming transcription
- [ ] Real-time captions overlay
- [ ] Transcript export (SRT, VTT, TXT, JSON)
- [ ] Audio capture (mic + system audio)
- [ ] In-app model downloader

### Database Schema

**transcription_queue table:**
- `id`, `meeting_id`, `audio_path`, `model`, `language`
- `enable_diarization`, `status`, `retry_count`
- `accepted_at`, `completed_at`, `error_message`
- Indexes on `status`, `meeting_id`, `created_at`

### API Endpoints

```
GET    /api/v1/desktop/queue                    # List pending jobs
POST   /api/v1/desktop/queue/{id}/accept        # Accept job
GET    /api/v1/desktop/queue/{id}/audio         # Download audio
POST   /api/v1/desktop/queue/{id}/result        # Submit result
```

### Configuration

```yaml
transcription:
  desktop:
    enabled: true
    job-timeout-minutes: 30      # Timeout for stalled jobs
    max-retries: 3                # Max retry attempts
    cleanup-retention-hours: 24   # Cleanup completed jobs
    retry-check-minutes: 5        # Check interval for retries
    timeout-check-minutes: 10     # Check interval for timeouts
```ate-of-the-art)
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
