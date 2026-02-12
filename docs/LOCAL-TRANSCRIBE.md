# Local Transcription

## Transcription Providers

| Provider | Location | Cost | Latency | Privacy |
|----------|----------|------|---------|----------|
| `remote_openai` | OpenAI Cloud | ~$0.006/min | ~5-10s | ❌ Data sent to cloud |
| `server_local` | Self-hosted server | Hardware cost | ~2-5s | ✅ On-premise |
| `desktop_local` | User's Mac | Free | <100ms | ✅ Never leaves device |

---

## Desktop Local Engine (PR 06)

### Core Technology

#### Transcription: whisper.cpp
- **Repository**: https://github.com/ggml-org/whisper.cpp (46k+ stars)
- **License**: MIT
- **Apple Silicon**: Native Metal GPU + Core ML + ANE support
- **Performance**: Up to 30x realtime on M-series Macs

#### Speaker Diarization: pyannote-audio
- **Repository**: https://github.com/pyannote/pyannote-audio (9k+ stars)
- **License**: MIT
- **Accuracy**: State-of-the-art (12-18% DER on benchmarks)
- **Features**: Speaker count estimation, overlapping speech detection

---

## Model Configuration

### Available Models
```yaml
models:
  large-v3:           # DEFAULT - Best accuracy
    size: 4GB
    speed: "~15x realtime"
    vram: "~4GB"
    accuracy: "Best"
    
  medium:
    size: 2GB
    speed: "~30x realtime"
    vram: "~2GB"
    accuracy: "Great"
    
  small:
    size: 1GB
    speed: "~45x realtime"
    vram: "~1GB"
    accuracy: "Good"
    
  base:
    size: 142MB
    speed: "~100x realtime"
    vram: "~400MB"
    accuracy: "Acceptable"
    
  tiny:
    size: 75MB
    speed: "~150x realtime"
    vram: "~300MB"
    accuracy: "Basic"
```

### Settings Schema
```yaml
desktop_transcription:
  default_model: "large-v3"    # User can change
  language: "auto"             # or specific ISO code
  enable_diarization: true     # Speaker identification
  enable_timestamps: true      # Word-level timestamps
  export_formats:
    - json
    - srt
    - vtt
    - txt
```

---

## Performance (Mac M3 Max 36GB)

| Model | 1 min audio | 1 hour meeting | Live capable |
|-------|-------------|----------------|---------------|
| large-v3 | ~4 sec | ~4 min | ✅ Yes (~66ms/sec) |
| medium | ~2 sec | ~2 min | ✅ Yes (~33ms/sec) |
| small | ~1.3 sec | ~1.3 min | ✅ Yes (~22ms/sec) |

---

## Use Cases

### 1. Live Meeting Transcription
```
User starts meeting → Audio captured → whisper.cpp (live) → Real-time captions
                                           ↓
                                    pyannote (speaker ID)
                                           ↓
                                    Display: "Speaker 1: ..."
```

### 2. Recorded Audio Processing
```
User imports file → whisper.cpp (batch) → High-accuracy transcript
                          ↓
                   pyannote (diarization)
                          ↓
                   Export/Sync to backend
```

### 3. Mobile-to-Desktop Workflow
```
iOS records meeting → Uploads to backend → Desktop accepts from queue
                                                    ↓
                                           Local processing
                                                    ↓
                                           POST transcript back
```

---

## Implementation Checklist

- [ ] whisper.cpp integration with Metal
- [ ] Model download/management UI
- [ ] pyannote-audio Python bridge
- [ ] Audio capture (mic + system audio)
- [ ] Real-time streaming mode
- [ ] Batch processing mode
- [ ] Settings UI for model selection
- [ ] Export to SRT/VTT/JSON/TXT
- [ ] Backend sync (POST transcripts)
- [ ] Queue acceptance from mobile uploads
