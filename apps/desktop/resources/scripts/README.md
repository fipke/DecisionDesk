# Desktop Transcription Scripts

## Setup

### 1. Install Python Dependencies

```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### 2. HuggingFace Authentication

Pyannote models require accepting their terms of service:

1. Create account at https://huggingface.co
2. Accept terms at https://huggingface.co/pyannote/speaker-diarization-3.1
3. Create access token at https://huggingface.co/settings/tokens
4. Set environment variable:

```bash
export HUGGINGFACE_TOKEN="hf_your_token_here"
```

Or pass token when running:
```bash
python diarize.py audio.m4a --hf-token "hf_your_token_here"
```

### 3. Test Diarization

```bash
python diarize.py /path/to/audio.m4a
```

Output:
```json
{
  "segments": [
    {"start": 0.0, "end": 5.2, "speaker": "SPEAKER_00"},
    {"start": 5.2, "end": 12.8, "speaker": "SPEAKER_01"}
  ]
}
```

## Scripts

### diarize.py

Speaker diarization using pyannote-audio.

**Usage:**
```bash
python diarize.py <audio_file> [--output result.json] [--hf-token <token>]
```

**Requirements:**
- Python 3.9+
- pyannote.audio 3.1+
- torch 2.0+ (with MPS support for Apple Silicon)
- HuggingFace account and API token

**Performance (M3 Max):**
- ~3x realtime with MPS acceleration
- ~15GB memory for long meetings (1+ hour)

## Integration

The whisper.ts service automatically calls diarize.py when `enableDiarization=true`:

1. Whisper transcribes audio → segments with timestamps
2. Diarization identifies speakers → speaker segments
3. Merge logic assigns speakers to transcript segments
4. Result submitted to backend with speaker labels

## Troubleshooting

**Error: "No module named 'pyannote'"**
```bash
pip install pyannote-audio torch torchaudio
```

**Error: "Access denied to model"**
- Accept terms at https://huggingface.co/pyannote/speaker-diarization-3.1
- Create HF token and set HUGGINGFACE_TOKEN environment variable

**Out of memory**
- For long meetings, consider splitting audio into chunks
- Reduce model precision (not recommended, affects quality)
- Use CPU fallback: `export PYTORCH_ENABLE_MPS_FALLBACK=1`

**Slow performance**
- Ensure torch is using MPS (Apple Silicon) or CUDA (NVIDIA)
- Check: `python -c "import torch; print(torch.backends.mps.is_available())"`
- Should print `True` on M-series Macs
