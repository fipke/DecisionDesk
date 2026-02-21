import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface AudioPlayerHandle {
  seek: (seconds: number) => void;
  getCurrentTime: () => number;
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
}

interface AudioPlayerControlledProps {
  meetingId: string;
  recordingUri?: string | null;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const AudioPlayerControlled = forwardRef<AudioPlayerHandle, AudioPlayerControlledProps>(
  function AudioPlayerControlled({ meetingId, recordingUri }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [speed, setSpeed] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Download audio through IPC if no local URI
    const { data: localAudioPath, isLoading } = useQuery({
      queryKey: ['audio-local', meetingId],
      queryFn: () => window.electronAPI.api.downloadAudio(meetingId),
      enabled: !recordingUri,
      retry: 1,
      staleTime: Infinity,
    });

    const src = recordingUri || localAudioPath;

    useImperativeHandle(ref, () => ({
      seek(seconds: number) {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = seconds;
          if (audio.paused) audio.play();
        }
      },
      getCurrentTime() {
        return audioRef.current?.currentTime ?? 0;
      },
      addEventListener(event: string, handler: () => void) {
        audioRef.current?.addEventListener(event, handler);
      },
      removeEventListener(event: string, handler: () => void) {
        audioRef.current?.removeEventListener(event, handler);
      },
    }));

    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.playbackRate = speed;
      }
    }, [speed]);

    const handleTimeUpdate = useCallback(() => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    }, []);

    const handleLoadedMetadata = useCallback(() => {
      if (audioRef.current) setDuration(audioRef.current.duration);
    }, []);

    const handlePlay = useCallback(() => setIsPlaying(true), []);
    const handlePause = useCallback(() => setIsPlaying(false), []);
    const handleError = useCallback(() => {
      const audio = audioRef.current;
      if (audio?.error) {
        console.error('[AudioPlayer] error:', audio.error.code, audio.error.message, 'src:', src);
      }
    }, [src]);

    const togglePlay = () => {
      const audio = audioRef.current;
      if (!audio || !src) return;
      if (audio.paused) {
        audio.play().catch((err) => console.error('[AudioPlayer] play failed:', err));
      } else {
        audio.pause();
      }
    };

    const handleSeekBar = (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (audio) audio.currentTime = parseFloat(e.target.value);
    };

    const cycleSpeed = () => {
      const idx = SPEEDS.indexOf(speed as typeof SPEEDS[number]);
      setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
    };

    function formatTime(sec: number): string {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    }

    if (isLoading) {
      return (
        <div className="rounded-lg border border-dd-border bg-dd-surface p-3 flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
          <span className="text-xs text-slate-500">Carregando audio...</span>
        </div>
      );
    }

    if (!src) return null;

    return (
      <div className="rounded-lg border border-dd-border bg-dd-surface p-3">
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
          preload="metadata"
          className="hidden"
        />
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-500 shrink-0"
          >
            {isPlaying ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Time */}
          <span className="text-xs text-slate-400 tabular-nums w-12 shrink-0">
            {formatTime(currentTime)}
          </span>

          {/* Seek bar */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeekBar}
            className="flex-1 h-1 accent-indigo-500 cursor-pointer"
          />

          {/* Duration */}
          <span className="text-xs text-slate-500 tabular-nums w-12 shrink-0 text-right">
            {formatTime(duration)}
          </span>

          {/* Speed */}
          <button
            onClick={cycleSpeed}
            className="rounded-md border border-dd-border px-2 py-0.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-500 shrink-0"
          >
            {speed}x
          </button>
        </div>
      </div>
    );
  }
);
