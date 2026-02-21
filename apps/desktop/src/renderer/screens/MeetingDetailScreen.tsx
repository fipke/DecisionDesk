import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Meeting, MeetingStatus, NoteBlock, NoteBlockType } from '../../shared/types';
import { TranscriptViewer } from '../components/transcript/TranscriptViewer';
import { AudioPlayerControlled } from '../components/transcript/AudioPlayerControlled';
import type { AudioPlayerHandle } from '../components/transcript/AudioPlayerControlled';

// ─── Helpers ─────────────────────────────────────────────────

function statusBadge(status: MeetingStatus) {
  const configs: Record<MeetingStatus, { label: string; classes: string; pulse?: boolean }> = {
    PENDING_SYNC: { label: 'Pendente',    classes: 'bg-dd-elevated text-slate-300' },
    NEW:          { label: 'Novo',        classes: 'bg-blue-700 text-blue-100' },
    PROCESSING:   { label: 'Processando', classes: 'bg-amber-600 text-amber-100', pulse: true },
    DONE:         { label: 'Concluído',   classes: 'bg-indigo-700 text-indigo-100' },
    ERROR:        { label: 'Erro',        classes: 'bg-red-700 text-red-100' },
  };
  const cfg = configs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.classes}`}>
      {cfg.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDurationDetail(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

// ─── Tab: Notas ───────────────────────────────────────────────

const BLOCK_TYPE_CONFIG: Record<NoteBlockType, { label: string; classes: string }> = {
  action_item: { label: 'Ação',      classes: 'bg-indigo-950/60 text-indigo-400 border-indigo-800' },
  decision:    { label: 'Decisão',   classes: 'bg-amber-950/60 text-amber-400 border-amber-800' },
  paragraph:   { label: 'Parágrafo', classes: 'bg-dd-elevated text-slate-400 border-dd-border' },
  heading:     { label: 'Título',    classes: 'bg-dd-elevated text-slate-300 border-dd-border' },
  question:    { label: 'Pergunta',  classes: 'bg-blue-950/60 text-blue-400 border-blue-800' },
  reference:   { label: 'Referência',classes: 'bg-violet-950/60 text-violet-400 border-violet-800' },
};

function NoteBlockItem({ block }: { block: NoteBlock }) {
  const cfg = BLOCK_TYPE_CONFIG[block.blockType];
  return (
    <div className="rounded-lg border border-dd-border bg-dd-surface p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${cfg.classes}`}>
          {cfg.label}
        </span>
        {block.speakerLabel && (
          <span className="text-xs text-slate-500">{block.speakerLabel}</span>
        )}
      </div>
      {block.blockType === 'heading' ? (
        <p className="font-semibold text-slate-100">{block.content}</p>
      ) : (
        <p className="text-sm text-slate-300 leading-relaxed">{block.content}</p>
      )}
    </div>
  );
}

function NotesTab({ meetingId }: { meetingId: string }) {
  const queryClient = useQueryClient();
  const [newContent, setNewContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['note-blocks', meetingId],
    queryFn: () => window.electronAPI.db.listNoteBlocks(meetingId),
  });

  const addBlockMutation = useMutation({
    mutationFn: (content: string) =>
      window.electronAPI.db.upsertNoteBlock({
        meetingId,
        content,
        blockType: 'paragraph',
        ordinal: blocks.length,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note-blocks', meetingId] });
      setNewContent('');
    },
  });

  const handleAdd = () => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    addBlockMutation.mutate(trimmed);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <p className="text-slate-400">Nenhuma nota registrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...blocks]
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((block) => (
              <NoteBlockItem key={block.id} block={block} />
            ))}
        </div>
      )}

      {/* Add paragraph */}
      <div className="rounded-xl border border-dd-border bg-dd-surface p-4">
        <p className="mb-2 text-xs font-medium text-slate-400">Adicionar nota</p>
        <textarea
          ref={textareaRef}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
          }}
          placeholder="Escreva uma nota e pressione ⌘Enter para salvar..."
          rows={3}
          className="w-full rounded-lg border border-dd-border bg-dd-elevated p-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleAdd}
            disabled={!newContent.trim() || addBlockMutation.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addBlockMutation.isPending ? 'Salvando...' : 'Salvar nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Resumo ──────────────────────────────────────────────

function SummaryTab({ meetingId }: { meetingId: string }) {
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['summary', meetingId],
    queryFn: () => window.electronAPI.api.fetchSummary(meetingId),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['api-templates'],
    queryFn: () => window.electronAPI.api.fetchTemplates(),
  });

  const generateMutation = useMutation({
    mutationFn: (templateId?: string) =>
      window.electronAPI.api.generateSummary(meetingId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['summary', meetingId] });
    },
  });

  if (loadingSummary) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      </div>
    );
  }

  if (summary) {
    return (
      <div className="rounded-xl border border-dd-border bg-dd-surface p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">
          {summary.text}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <svg className="h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <p className="mt-4 text-slate-400">Resumo não disponível.</p>

      {/* Template picker */}
      {templates.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplateId(t.id === selectedTemplateId ? undefined : t.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                t.id === selectedTemplateId
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                  : 'border-dd-border bg-dd-elevated text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.name}
              {t.isDefault && ' ★'}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => generateMutation.mutate(selectedTemplateId)}
        disabled={generateMutation.isPending}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {generateMutation.isPending ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Gerando...
          </span>
        ) : (
          'Gerar Resumo'
        )}
      </button>

      {generateMutation.isError && (
        <p className="mt-2 text-xs text-red-400">
          Erro ao gerar resumo. Verifique se a gravação tem transcrição.
        </p>
      )}
    </div>
  );
}

// ─── Transcribe button (unified: Whisper local + OpenAI) ──────

function TranscribeButton({ meetingId, recordingUri, hasTranscript, externalOpen, onOpenChange }: {
  meetingId: string;
  recordingUri?: string | null;
  hasTranscript?: boolean;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (v: boolean) => { setInternalOpen(v); onOpenChange?.(v); };
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    queryClient.invalidateQueries({ queryKey: ['meetings'] });
    queryClient.invalidateQueries({ queryKey: ['segments', meetingId] });
    queryClient.invalidateQueries({ queryKey: ['speakers', meetingId] });
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // OpenAI remote transcription (backend handles it)
  const openaiMutation = useMutation({
    mutationFn: () =>
      window.electronAPI.api.transcribeMeeting(meetingId, { provider: 'remote_openai' }),
    onSuccess: () => {
      setStatusMsg(null);
      setErrorMsg(null);
      setOpen(false);
      invalidate();
    },
    onError: (err) => {
      setStatusMsg(null);
      const msg = (err as Error)?.message ?? 'Erro desconhecido';
      setErrorMsg(`Falha ao transcrever via OpenAI: ${msg}`);
      console.error('[Transcribe OpenAI]', err);
    },
  });

  // Whisper local transcription
  const whisperMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const status = await window.electronAPI.whisper.getStatus();
      if (!status.available) throw new Error('whisper-cli não encontrado no sistema. Instale via: brew install whisper-cpp');

      let audioPath = recordingUri;
      if (!audioPath) {
        setStatusMsg('Baixando áudio do servidor...');
        try {
          audioPath = await window.electronAPI.api.downloadAudio(meetingId);
        } catch (dlErr) {
          throw new Error(`Falha ao baixar áudio: ${(dlErr as Error)?.message ?? 'erro desconhecido'}. Verifique se a gravação tem áudio no servidor.`);
        }
      }

      setStatusMsg('Transcrevendo com Whisper (pode levar alguns minutos)...');
      const settings = await window.electronAPI.settings.get();
      const result = await window.electronAPI.whisper.transcribe(audioPath, {
        model: settings.whisperModel ?? 'large-v3',
        language: 'pt',
        enableDiarization: settings.enableDiarization ?? true,
      });

      if (!result.text || result.text.trim().length === 0) {
        throw new Error('Whisper não conseguiu extrair texto do áudio. O arquivo pode estar vazio ou corrompido.');
      }

      setStatusMsg('Salvando transcrição...');
      await window.electronAPI.db.upsertMeeting({
        id: meetingId,
        transcriptText: result.text,
        language: result.language ?? 'pt',
        status: 'DONE',
      });

      // Persist structured segments + speakers if available
      if (result.segments && result.segments.length > 0) {
        // Clear old segments first
        await window.electronAPI.db.deleteSegments(meetingId);

        // Extract unique speakers and create MeetingSpeaker rows
        const speakerLabels = [...new Set(
          result.segments.map((s: { speaker?: string }) => s.speaker).filter(Boolean) as string[]
        )];
        const speakerMap = new Map<string, string>(); // label → speaker id
        for (let i = 0; i < speakerLabels.length; i++) {
          const speaker = await window.electronAPI.db.upsertMeetingSpeaker({
            meetingId,
            label: speakerLabels[i],
            colorIndex: i % 8,
            talkTimeSec: 0,
          });
          speakerMap.set(speakerLabels[i], speaker.id);
        }

        // Insert segments with speaker references
        const segmentData = result.segments.map((s: { start: number; end: number; text: string; speaker?: string }, i: number) => ({
          meetingId,
          ordinal: i,
          startSec: s.start,
          endSec: s.end,
          text: s.text,
          speakerLabel: s.speaker ?? null,
          speakerId: s.speaker ? (speakerMap.get(s.speaker) ?? null) : null,
        }));
        await window.electronAPI.db.insertSegmentsBatch(meetingId, segmentData);

        // Update talk time stats per speaker
        for (const [label, speakerId] of speakerMap) {
          const talkTime = result.segments
            .filter((s: { speaker?: string }) => s.speaker === label)
            .reduce((sum: number, s: { start: number; end: number }) => sum + (s.end - s.start), 0);
          await window.electronAPI.db.upsertMeetingSpeaker({
            id: speakerId,
            meetingId,
            label,
            colorIndex: speakerLabels.indexOf(label) % 8,
            talkTimeSec: talkTime,
          });
        }
      }

      try { await window.electronAPI.db.triggerSync(); } catch { /* best-effort */ }

      return result;
    },
    onSuccess: () => {
      setStatusMsg(null);
      setErrorMsg(null);
      setOpen(false);
      invalidate();
    },
    onError: (err) => {
      setStatusMsg(null);
      const msg = (err as Error)?.message ?? 'Erro desconhecido';
      setErrorMsg(msg);
      console.error('[Transcribe Whisper]', err);
    },
  });

  const isPending = openaiMutation.isPending || whisperMutation.isPending;

  return (
    <div className="relative">
      <button
        onClick={() => { setErrorMsg(null); setOpen(!open); }}
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {statusMsg ?? 'Transcrevendo...'}
          </span>
        ) : (
          hasTranscript ? 'Re-transcrever' : 'Transcrever'
        )}
      </button>

      {open && !isPending && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-dd-border bg-dd-elevated shadow-lg overflow-hidden">
          <button
            onClick={() => { setOpen(false); whisperMutation.mutate(); }}
            className="block w-full px-4 py-2.5 text-left hover:bg-dd-surface"
          >
            <span className="text-xs font-medium text-slate-200">Whisper local</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">whisper.cpp no seu Mac</span>
          </button>
          <div className="border-t border-dd-border" />
          <button
            onClick={() => { setOpen(false); openaiMutation.mutate(); }}
            className="block w-full px-4 py-2.5 text-left hover:bg-dd-surface"
          >
            <span className="text-xs font-medium text-slate-200">OpenAI</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">Whisper API na nuvem</span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="absolute right-0 top-full z-10 mt-1 w-72 rounded-lg border border-red-800 bg-red-950/90 p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <svg className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium text-red-300">Erro na transcrição</p>
              <p className="mt-1 text-xs text-red-400/80">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-300">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reset status button ─────────────────────────────────────

function ResetStatusButton({ meetingId }: { meetingId: string }) {
  const queryClient = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: () => window.electronAPI.api.resetMeetingStatus(meetingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  return (
    <button
      onClick={() => resetMutation.mutate()}
      disabled={resetMutation.isPending}
      className="rounded-md border border-dd-border bg-transparent px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50"
    >
      {resetMutation.isPending ? 'Reiniciando...' : 'Reiniciar status'}
    </button>
  );
}

// ─── MeetingDetailScreen ──────────────────────────────────────

type Tab = 'transcript' | 'notes' | 'summary';

export function MeetingDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const audioRef = useRef<AudioPlayerHandle>(null);
  const [transcribeOpen, setTranscribeOpen] = useState(false);

  const { data: meeting, isLoading, error } = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => {
      // Fetch both local and remote, merge (remote is authoritative)
      const [local, remote] = await Promise.all([
        window.electronAPI.db.getMeeting(id!),
        window.electronAPI.api.fetchMeeting(id!).catch(() => null),
      ]);
      if (!remote && !local) return null;
      if (!remote) return local;
      if (!local) return remote;
      // Merge: remote is authoritative, but preserve local-only data
      // (e.g., transcript from local whisper that hasn't synced to backend yet)
      return {
        ...remote,
        recordingUri: local.recordingUri ?? remote.recordingUri,
        transcriptText: remote.transcriptText || local.transcriptText || null,
        language: remote.language || local.language || null,
        status: remote.transcriptText ? remote.status : (local.transcriptText ? local.status : remote.status),
      };
    },
    enabled: !!id,
    // Auto-poll every 5s while meeting is processing
    refetchInterval: (query) => {
      const m = query.state.data;
      return m?.status === 'PROCESSING' ? 5000 : false;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: (title: string) =>
      window.electronAPI.db.upsertMeeting({ id: id!, title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  const handleTitleBlur = () => {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== (meeting?.title ?? '')) {
      upsertMutation.mutate(trimmed);
    }
  };

  const startEditTitle = () => {
    setTitleValue(meeting?.title ?? '');
    setEditingTitle(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Gravação não encontrada</p>
          <button
            onClick={() => navigate('/meetings')}
            className="mt-4 rounded-lg bg-dd-elevated px-4 py-2 text-sm hover:bg-dd-elevated text-slate-100"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'transcript', label: 'Transcrição' },
    { key: 'notes',      label: 'Notas' },
    { key: 'summary',    label: 'Resumo' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-dd-border bg-dd-base px-6 py-4">
        {/* Back link */}
        <button
          onClick={() => navigate('/meetings')}
          className="mb-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Gravações
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Editable title */}
            {editingTitle ? (
              <input
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { setEditingTitle(false); }
                }}
                className="w-full rounded-md border border-indigo-500 bg-dd-elevated px-2 py-1 text-xl font-bold text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            ) : (
              <button
                onClick={startEditTitle}
                className="group flex items-center gap-2 text-left"
                title="Clique para editar"
              >
                <h2 className="text-xl font-bold text-slate-100">
                  {meeting.title ?? 'Gravação'}
                </h2>
                <svg
                  className="h-4 w-4 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}

            <p className="mt-1 text-sm text-slate-500">
              {formatDate(meeting.createdAt)}
              {meeting.durationSec != null && meeting.durationSec > 0 && (
                <span> · {formatDurationDetail(meeting.durationSec)}</span>
              )}
              {meeting.durationSec == null && meeting.minutes != null && meeting.minutes > 0 && (
                <span> · {meeting.minutes} min</span>
              )}
            </p>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            {statusBadge(meeting.status)}

            {(meeting.status === 'PROCESSING' || meeting.status === 'ERROR') && (
              <ResetStatusButton meetingId={meeting.id} />
            )}

            {meeting.status !== 'PROCESSING' && (
              <TranscribeButton meetingId={meeting.id} recordingUri={meeting.recordingUri} hasTranscript={!!meeting.transcriptText} externalOpen={transcribeOpen} onOpenChange={setTranscribeOpen} />
            )}
          </div>
        </div>

        {/* Processing banner */}
        {meeting.status === 'PROCESSING' && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-800/50 bg-amber-950/40 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600/30 border-t-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-200">Transcrição em andamento</p>
              <p className="text-xs text-amber-400/70">A página atualizará automaticamente quando concluir.</p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {meeting.status === 'ERROR' && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3">
            <svg className="h-5 w-5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-200">Erro na transcrição</p>
              <p className="text-xs text-red-400/70">Use "Reiniciar status" para tentar novamente.</p>
            </div>
          </div>
        )}

        {/* Audio player */}
        <div className="mt-3">
          <AudioPlayerControlled ref={audioRef} meetingId={meeting.id} recordingUri={meeting.recordingUri} />
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex gap-1 border-b border-dd-border -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {activeTab === 'transcript' && <TranscriptViewer meeting={meeting} audioRef={audioRef} onRetranscribe={() => setTranscribeOpen(true)} />}
        {activeTab === 'notes'      && <NotesTab meetingId={meeting.id} />}
        {activeTab === 'summary'    && <SummaryTab meetingId={meeting.id} />}
      </div>
    </div>
  );
}
