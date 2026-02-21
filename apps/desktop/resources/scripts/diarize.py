#!/usr/bin/env python3
"""
Pyannote speaker diarization service for DecisionDesk.

This script runs pyannote-audio speaker diarization on audio files
and outputs speaker-tagged segments in JSON format.

Requirements:
    pip install pyannote.audio torch torchaudio

Usage:
    python diarize.py <audio_file> [--output <json_file>] [--hf-token <token>]

The script outputs JSON with speaker segments:
{
    "segments": [
        {"start": 0.0, "end": 5.2, "speaker": "SPEAKER_00"},
        {"start": 5.2, "end": 12.8, "speaker": "SPEAKER_01"},
        ...
    ]
}
"""

import argparse
import json
import sys
from pathlib import Path

def check_dependencies():
    """Check if required packages are installed."""
    try:
        import torch
        import pyannote.audio
        return True
    except ImportError as e:
        print(f"Missing dependency: {e}", file=sys.stderr)
        print("Install with: pip install pyannote.audio torch torchaudio", file=sys.stderr)
        return False

def diarize(audio_path: str, hf_token: str = None) -> dict:
    """
    Run speaker diarization on an audio file.
    
    Args:
        audio_path: Path to the audio file
        hf_token: HuggingFace token for pyannote.audio model access
        
    Returns:
        Dictionary with speaker segments
    """
    from pyannote.audio import Pipeline
    import torch

    # Use GPU if available
    device = torch.device("mps" if torch.backends.mps.is_available() 
                          else "cuda" if torch.cuda.is_available() 
                          else "cpu")
    
    # Load pyannote pipeline
    # Note: Requires accepting pyannote terms at https://huggingface.co/pyannote/speaker-diarization-3.1
    # `use_auth_token` was removed in huggingface_hub>=0.20; use `token` instead.
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        token=hf_token
    )
    pipeline.to(device)

    # Run diarization
    result = pipeline(audio_path)

    # pyannote v4.x returns DiarizeOutput; v3.x returns Annotation directly
    diarization = getattr(result, 'speaker_diarization', result)

    # Convert to segments
    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append({
            "start": round(turn.start, 3),
            "end": round(turn.end, 3),
            "speaker": speaker
        })
    
    return {"segments": segments}

def merge_with_transcript(diarization: dict, transcript_segments: list) -> list:
    """
    Merge diarization speaker labels with transcript segments.
    
    Args:
        diarization: Diarization result with speaker segments
        transcript_segments: Transcript segments with timestamps
        
    Returns:
        Transcript segments with added speaker labels
    """
    speaker_segments = diarization["segments"]
    
    for trans_seg in transcript_segments:
        trans_mid = (trans_seg["start"] + trans_seg["end"]) / 2
        
        # Find overlapping speaker segment
        for spk_seg in speaker_segments:
            if spk_seg["start"] <= trans_mid <= spk_seg["end"]:
                trans_seg["speaker"] = spk_seg["speaker"]
                break
        else:
            trans_seg["speaker"] = "UNKNOWN"
    
    return transcript_segments

def main():
    parser = argparse.ArgumentParser(
        description="Run speaker diarization on audio files"
    )
    parser.add_argument("audio_file", help="Path to audio file")
    parser.add_argument("--output", "-o", help="Output JSON file (default: stdout)")
    parser.add_argument("--hf-token", help="HuggingFace token for pyannote access")
    parser.add_argument("--transcript", help="Transcript JSON to merge with diarization")
    
    args = parser.parse_args()
    
    if not check_dependencies():
        sys.exit(1)
    
    audio_path = Path(args.audio_file)
    if not audio_path.exists():
        print(f"Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)
    
    # Get HF token from arg or environment
    import os
    hf_token = args.hf_token or os.environ.get("HUGGINGFACE_TOKEN")
    
    if not hf_token:
        print("Warning: No HuggingFace token provided.", file=sys.stderr)
        print("pyannote/speaker-diarization-3.1 is a gated model — a FREE token is required", file=sys.stderr)
        print("only once to download the weights (inference runs 100% locally after that).", file=sys.stderr)
        print("Steps:", file=sys.stderr)
        print("  1. Accept terms at https://huggingface.co/pyannote/speaker-diarization-3.1", file=sys.stderr)
        print("  2. Create a read token at https://huggingface.co/settings/tokens", file=sys.stderr)
        print("  3. Set HUGGINGFACE_TOKEN env var or pass --hf-token <token>", file=sys.stderr)
    
    print(f"Running diarization on {audio_path}...", file=sys.stderr)
    
    try:
        result = diarize(str(audio_path), hf_token)
        
        # Optionally merge with transcript
        if args.transcript:
            with open(args.transcript, "r") as f:
                transcript = json.load(f)
            if "segments" in transcript:
                result["transcript_segments"] = merge_with_transcript(
                    result, transcript["segments"]
                )
        
        # Output result
        output_json = json.dumps(result, indent=2, ensure_ascii=False)
        
        if args.output:
            with open(args.output, "w") as f:
                f.write(output_json)
            print(f"Output written to {args.output}", file=sys.stderr)
        else:
            print(output_json)
            
    except Exception as e:
        print(f"Diarization failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
