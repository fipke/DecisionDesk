import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

// ─── Types ───────────────────────────────────────────────────

type AudioSourceMode = 'mic' | 'system' | 'mic+system';

interface RecordingState {
  isRecording: boolean;
  isPreparing: boolean;
  durationMs: number;
  source: AudioSourceMode;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return h > 0 ? `${h.toString().padStart(2, '0')}:${m}:${s}` : `${m}:${s}`;
}

const SOURCE_LABELS: Record<AudioSourceMode, { label: string; desc: string }> = {
  mic: { label: 'Microfone', desc: 'Gravações presenciais' },
  system: { label: 'Áudio do sistema', desc: 'Ouvir chamadas' },
  'mic+system': { label: 'Mic + Sistema', desc: 'Participar de videochamadas' },
};

// ─── Waveform Component ──────────────────────────────────────

function Waveform({ analyser, isRecording }: { analyser: AnalyserNode | null; isRecording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BAR_COUNT = 40;
    const BAR_GAP = 3;

    function draw() {
      if (!ctx || !canvas) return;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;
      const dataArray = new Uint8Array(analyser?.frequencyBinCount ?? 128);
      if (analyser && isRecording) {
        analyser.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.floor((i / BAR_COUNT) * dataArray.length);
        const value = isRecording && analyser ? dataArray[idx] / 255 : 0;
        const barHeight = Math.max(4, value * height * 0.85);
        const x = i * (barWidth + BAR_GAP);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = isRecording ? '#818cf8' : '#252c42';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [analyser, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={100}
      className="w-full max-w-md"
    />
  );
}

// ─── RecordScreen ────────────────────────────────────────────

export function RecordScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPreparing: false,
    durationMs: 0,
    source: 'mic',
  });
  const [liveNotes, setLiveNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setState(s => ({ ...s, isPreparing: true }));

    try {
      let stream: MediaStream;

      if (state.source === 'mic') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else if (state.source === 'system') {
        // System audio via desktopCapturer (Electron)
        const sources = await (window as any).electronAPI?.desktopCapturer?.getSources?.({ types: ['screen'] });
        if (!sources?.length) {
          // Fallback: ask for display media
          stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
          // Remove video track, keep only audio
          stream.getVideoTracks().forEach(t => t.stop());
          if (stream.getAudioTracks().length === 0) {
            throw new Error('Nenhum áudio do sistema disponível. Verifique as permissões.');
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
              },
            } as any,
            video: false,
          });
        }
      } else {
        // mic + system: merge both streams
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        let sysStream: MediaStream;
        try {
          sysStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
          sysStream.getVideoTracks().forEach(t => t.stop());
        } catch {
          // If system audio fails, fallback to mic only
          sysStream = micStream;
        }

        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        audioCtx.createMediaStreamSource(micStream).connect(dest);
        if (sysStream !== micStream && sysStream.getAudioTracks().length > 0) {
          audioCtx.createMediaStreamSource(sysStream).connect(dest);
        }
        audioCtxRef.current = audioCtx;
        stream = dest.stream;
      }

      // Set up analyser for waveform
      const audioCtx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000); // collect in 1s chunks

      // Timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setState(s => ({ ...s, durationMs: Date.now() - startTimeRef.current }));
      }, 200);

      setState(s => ({ ...s, isRecording: true, isPreparing: false, durationMs: 0 }));
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao iniciar gravação');
      setState(s => ({ ...s, isPreparing: false }));
    }
  }, [state.source]);

  const stopRecording = useCallback(async () => {
    setState(s => ({ ...s, isPreparing: true }));

    try {
      const recorder = mediaRecorderRef.current;
      if (!recorder) throw new Error('Gravador não encontrado');

      // Stop recorder and wait for final data
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop all tracks
      recorder.stream.getTracks().forEach(t => t.stop());

      // Build blob
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();

      // Save via IPC
      const filePath = await window.electronAPI.recording.save(arrayBuffer);

      // Create local meeting + enqueue sync
      const meeting = await window.electronAPI.recording.createMeeting(filePath, liveNotes.trim() || undefined);

      // Invalidate meetings query so list refreshes
      queryClient.invalidateQueries({ queryKey: ['meetings'] });

      // Navigate to meeting detail
      navigate(`/meetings/${meeting.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao salvar gravação');
      setState(s => ({ ...s, isPreparing: false, isRecording: false }));
    }
  }, [liveNotes, navigate, queryClient]);

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Gravar</h2>
          <p className="mt-1 text-sm text-slate-400">Capture áudio com anotações ao vivo</p>
        </div>
        <button
          onClick={() => navigate('/meetings')}
          className="rounded-lg bg-dd-elevated px-4 py-2 text-sm text-slate-300 hover:bg-dd-elevated"
        >
          Voltar
        </button>
      </div>

      {/* Audio source selector */}
      {!state.isRecording && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Fonte de áudio</p>
          <div className="flex gap-2">
            {(Object.keys(SOURCE_LABELS) as AudioSourceMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setState(s => ({ ...s, source: mode }))}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  state.source === mode
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-dd-border bg-dd-surface text-slate-400 hover:border-dd-border'
                }`}
              >
                <p className="text-sm font-medium">{SOURCE_LABELS[mode].label}</p>
                <p className="mt-0.5 text-xs opacity-70">{SOURCE_LABELS[mode].desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2.5 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Recording area */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Waveform */}
        <Waveform analyser={analyserRef.current} isRecording={state.isRecording} />

        {/* Timer */}
        <p className="mt-6 font-mono text-5xl font-bold text-slate-100">
          {formatDuration(state.durationMs)}
        </p>

        {/* Status */}
        <div className="mt-3 flex items-center gap-2">
          {state.isRecording && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          )}
          <span className="text-sm text-slate-400">
            {state.isRecording
              ? `Gravando — ${SOURCE_LABELS[state.source].label}`
              : 'Pronto para gravar'}
          </span>
        </div>

        {/* Action button */}
        <button
          onClick={state.isRecording ? stopRecording : startRecording}
          disabled={state.isPreparing}
          className={`mt-8 rounded-2xl px-12 py-4 text-base font-semibold text-white transition-colors ${
            state.isRecording
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-indigo-600 hover:bg-indigo-500'
          } ${state.isPreparing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {state.isPreparing
            ? 'Aguarde...'
            : state.isRecording
              ? 'Parar e salvar'
              : 'Gravar agora'}
        </button>
      </div>

      {/* Live notes (always visible, expands when recording) */}
      <div className={`mt-6 ${state.isRecording ? '' : 'opacity-60'}`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Anotações ao vivo
        </p>
        <textarea
          value={liveNotes}
          onChange={(e) => setLiveNotes(e.target.value)}
          placeholder="Digite anotações durante a gravação..."
          rows={state.isRecording ? 5 : 3}
          className="w-full resize-none rounded-lg border border-dd-border bg-dd-surface px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}
