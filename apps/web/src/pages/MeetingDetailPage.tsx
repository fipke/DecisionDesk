import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, RotateCcw, Mic, ChevronDown, ChevronRight,
  Plus, Trash2, RefreshCw, Sparkles, CheckSquare, Lightbulb,
} from 'lucide-react';
import { useMeetingDetail } from '../hooks/useMeetingDetail';
import {
  fetchTemplates, fetchSummary, fetchSummaries, generateSummary,
  generateAllSummaries, deleteSummary,
  resetMeetingStatus, getAudioUrl, transcribeMeeting,
  fetchNotes, updateAgenda, updateLiveNotes, updatePostNotes,
} from '../services/api';
import type { MeetingStatus, SummaryTemplate, Summary, NotesResponse, ActionItem } from '../types';

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MeetingStatus, { label: string; classes: string }> = {
  NEW: { label: 'Novo', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PROCESSING: { label: 'Processando', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' },
  DONE: { label: 'Concluído', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ERROR: { label: 'Erro', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

function StatusBadge({ status }: { status: MeetingStatus }) {
  const { label, classes } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      {label}
    </span>
  );
}

// ─── Transcript parser ──────────────────────────────────────────────────────

const TRANSCRIPT_LINE_RE = /^(?:(\d+):)?(\d{2}):(\d{2})\s+([^:]+):\s+(.+)$/;

interface TranscriptLine {
  timestamp: string;
  speaker: string;
  text: string;
}

function parseTranscript(raw: string): TranscriptLine[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = TRANSCRIPT_LINE_RE.exec(line);
      if (!match) return null;
      const [, hours, minutes, seconds, speaker, text] = match;
      const ts = hours
        ? `${hours}:${minutes}:${seconds}`
        : `${minutes}:${seconds}`;
      return { timestamp: ts, speaker: speaker.trim(), text: text.trim() };
    })
    .filter((l): l is TranscriptLine => l !== null);
}

// ─── Duration formatter ─────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

// ─── Tab types ──────────────────────────────────────────────────────────────

type Tab = 'transcricao' | 'resumo';

const TABS: { id: Tab; label: string }[] = [
  { id: 'transcricao', label: 'Transcrição' },
  { id: 'resumo', label: 'Resumos' },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: meeting, isLoading, isError } = useMeetingDetail(id);
  const [activeTab, setActiveTab] = useState<Tab>('transcricao');

  const resetMutation = useMutation({
    mutationFn: () => resetMeetingStatus(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  const transcribeMutation = useMutation({
    mutationFn: (provider?: string) => transcribeMeeting(id!, provider ? { provider } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dd-base">
        <p className="text-slate-500 text-sm">Carregando gravação...</p>
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dd-base">
        <p className="text-red-400 text-sm">Gravação não encontrada.</p>
      </div>
    );
  }

  const title = meeting.title ?? 'Gravação';
  const dateStr = new Date(meeting.createdAt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const transcriptLines = meeting.transcriptText
    ? parseTranscript(meeting.transcriptText)
    : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-dd-base">
      {/* Header */}
      <div className="px-6 pt-5 pb-0 border-b border-dd-border bg-dd-base sticky top-0 z-10">
        <button
          type="button"
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={15} />
          Gravações
        </button>

        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="text-slate-100 text-xl font-semibold">{title}</h1>
          <div className="flex items-center gap-2">
            <StatusBadge status={meeting.status} />
            {!meeting.transcriptText && meeting.status !== 'PROCESSING' && (
              <button
                type="button"
                onClick={() => transcribeMutation.mutate('remote_openai')}
                disabled={transcribeMutation.isPending}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {transcribeMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Mic size={12} />
                )}
                {transcribeMutation.isPending ? 'Transcrevendo...' : 'Transcrever'}
              </button>
            )}
            {(meeting.status === 'PROCESSING' || meeting.status === 'ERROR') && (
              <button
                type="button"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                className="flex items-center gap-1 rounded-lg border border-dd-border px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50"
                title="Reiniciar status para Novo"
              >
                <RotateCcw size={12} className={resetMutation.isPending ? 'animate-spin' : ''} />
                Reiniciar
              </button>
            )}
            {transcribeMutation.isError && (
              <span className="text-xs text-red-400">Erro ao transcrever</span>
            )}
          </div>
        </div>
        <p className="text-slate-500 text-xs mb-2">
          {dateStr}
          {meeting.durationSec != null && meeting.durationSec > 0 && (
            <span> · {formatDuration(meeting.durationSec)}</span>
          )}
          {meeting.durationSec == null && meeting.minutes != null && meeting.minutes > 0 && (
            <span> · {meeting.minutes} min</span>
          )}
        </p>

        {/* Audio player */}
        <div className="mb-4 rounded-lg border border-dd-border bg-dd-surface p-3">
          <audio
            controls
            src={getAudioUrl(id!)}
            className="w-full h-8"
            preload="none"
          >
            Seu navegador não suporta reprodução de áudio.
          </audio>
        </div>

        {/* Tab bar (center panel) */}
        <div className="flex gap-1">
          {TABS.map(({ id: tabId, label }) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setActiveTab(tabId)}
              className={[
                'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                activeTab === tabId
                  ? 'text-indigo-400 border-indigo-500 bg-indigo-500/5'
                  : 'text-slate-400 border-transparent hover:text-slate-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-panel layout for wide screens, stacked for narrow */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: AI Panel (hidden on narrow) */}
        <AiPanel meetingId={id!} />

        {/* Center: Main content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-w-0">
          {activeTab === 'transcricao' && (
            <TranscriptionContent
              transcriptText={meeting.transcriptText}
              transcriptLines={transcriptLines}
            />
          )}
          {activeTab === 'resumo' && (
            <MultiSummaryTab meetingId={id!} />
          )}
        </div>

        {/* Right: Notes Panel (hidden on narrow) */}
        <NotesPanel meetingId={id!} />
      </div>
    </div>
  );
}

// ─── Transcription Content ──────────────────────────────────────────────────

function TranscriptionContent({
  transcriptText,
  transcriptLines,
}: {
  transcriptText?: string | null;
  transcriptLines: TranscriptLine[];
}) {
  if (!transcriptText) {
    return <p className="text-slate-500 text-sm">Nenhuma transcrição disponível.</p>;
  }

  if (transcriptLines.length > 0) {
    return (
      <div className="space-y-3">
        {transcriptLines.map((line, idx) => (
          <div key={idx} className="flex gap-3">
            <span className="text-slate-500 text-xs font-mono mt-0.5 w-14 shrink-0 text-right">
              {line.timestamp}
            </span>
            <div className="flex-1">
              <span className="text-indigo-400 text-xs font-semibold mr-2">
                {line.speaker}:
              </span>
              <span className="text-slate-300 text-sm">{line.text}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
      {transcriptText}
    </p>
  );
}

// ─── AI Panel (Left) ────────────────────────────────────────────────────────

function AiPanel({ meetingId }: { meetingId: string }) {
  const { data: notes } = useQuery({
    queryKey: ['notes', meetingId],
    queryFn: () => fetchNotes(meetingId),
  });

  const actionItems = notes?.actionItems ?? [];
  const decisions = notes?.decisions ?? [];

  return (
    <div className="hidden xl:flex flex-col w-[220px] border-r border-dd-border bg-dd-surface overflow-y-auto shrink-0">
      <div className="p-4 space-y-5">
        {/* Action Items */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <CheckSquare size={13} className="text-indigo-400" />
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Ações</h3>
          </div>
          {actionItems.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma ação extraída.</p>
          ) : (
            <ul className="space-y-1.5">
              {actionItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-xs">
                  <span className={`mt-0.5 ${item.completed ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {item.completed ? '✓' : '○'}
                  </span>
                  <span className={`${item.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                    {item.text}
                    {item.assignee && (
                      <span className="text-indigo-400 ml-1">@{item.assignee}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Decisions */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb size={13} className="text-amber-400" />
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Decisões</h3>
          </div>
          {decisions.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma decisão registrada.</p>
          ) : (
            <ul className="space-y-1.5">
              {decisions.map((d, idx) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notes Panel (Right) ────────────────────────────────────────────────────

function NotesPanel({ meetingId }: { meetingId: string }) {
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', meetingId],
    queryFn: () => fetchNotes(meetingId),
  });

  return (
    <div className="hidden lg:flex flex-col w-[300px] border-l border-dd-border bg-dd-surface overflow-y-auto shrink-0">
      <div className="p-4 space-y-1">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Notas</h2>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={16} className="text-slate-500 animate-spin" />
          </div>
        ) : (
          <>
            <NoteSection
              title="Agenda"
              content={notes?.agenda ?? ''}
              meetingId={meetingId}
              field="agenda"
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['notes', meetingId] })}
            />
            <NoteSection
              title="Notas ao Vivo"
              content={notes?.liveNotes ?? ''}
              meetingId={meetingId}
              field="live"
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['notes', meetingId] })}
            />
            <NoteSection
              title="Pós-Reunião"
              content={notes?.postNotes ?? ''}
              meetingId={meetingId}
              field="post"
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['notes', meetingId] })}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Collapsible Note Section ───────────────────────────────────────────────

function NoteSection({
  title,
  content,
  meetingId,
  field,
  onSaved,
}: {
  title: string;
  content: string;
  meetingId: string;
  field: 'agenda' | 'live' | 'post';
  onSaved: () => void;
}) {
  const [expanded, setExpanded] = useState(!!content);
  const [text, setText] = useState(content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when backend data changes
  useEffect(() => {
    setText(content);
  }, [content]);

  const save = useCallback(
    (value: string) => {
      const fn = field === 'agenda' ? updateAgenda : field === 'live' ? updateLiveNotes : updatePostNotes;
      fn(meetingId, value).then(onSaved).catch(() => {});
    },
    [meetingId, field, onSaved],
  );

  const handleChange = (value: string) => {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(value), 500);
  };

  return (
    <div className="border-b border-dd-border last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
        {content && <span className="ml-auto text-indigo-400 text-[10px]">●</span>}
      </button>
      {expanded && (
        <textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Escreva ${title.toLowerCase()} aqui...`}
          className="w-full bg-dd-elevated border border-dd-border rounded-lg p-2 text-xs text-slate-300 placeholder-slate-600 resize-y min-h-[80px] mb-2 focus:outline-none focus:border-indigo-500/40"
          rows={4}
        />
      )}
    </div>
  );
}

// ─── Multi-Summary Tab ──────────────────────────────────────────────────────

function MultiSummaryTab({ meetingId }: { meetingId: string }) {
  const queryClient = useQueryClient();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeSummaryIdx, setActiveSummaryIdx] = useState(0);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const { data: summaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ['summaries', meetingId],
    queryFn: () => fetchSummaries(meetingId),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['summaries', meetingId] });
    queryClient.invalidateQueries({ queryKey: ['summary', meetingId] });
  };

  const generateMut = useMutation({
    mutationFn: (templateId?: string) => generateSummary(meetingId, templateId),
    onSuccess: () => {
      invalidate();
      setShowTemplatePicker(false);
    },
  });

  const generateAllMut = useMutation({
    mutationFn: () => generateAllSummaries(meetingId),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (summaryId: string) => deleteSummary(meetingId, summaryId),
    onSuccess: () => {
      invalidate();
      setActiveSummaryIdx(0);
    },
  });

  if (summariesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="text-slate-500 animate-spin" />
      </div>
    );
  }

  // Build template name map for lookup
  const templateMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of templates) m.set(t.id, t.name);
    return m;
  }, [templates]);

  // Existing summaries — show sub-tabs
  if (summaries.length > 0) {
    const current = summaries[activeSummaryIdx] ?? summaries[0];
    const getLabel = (s: Summary) =>
      (s.templateId && templateMap.get(s.templateId)) || s.templateName || 'Resumo';

    return (
      <div>
        {/* Summary sub-tabs */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {summaries.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSummaryIdx(idx)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                activeSummaryIdx === idx
                  ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                  : 'bg-dd-elevated text-slate-400 border-dd-border hover:border-indigo-500/30 hover:text-slate-200',
              ].join(' ')}
            >
              {getLabel(s)}
            </button>
          ))}
          {/* Add new summary button */}
          <button
            type="button"
            onClick={() => setShowTemplatePicker(!showTemplatePicker)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-dashed border-dd-border text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors"
          >
            <Plus size={12} />
          </button>
          {/* Generate all button */}
          <button
            type="button"
            onClick={() => generateAllMut.mutate()}
            disabled={generateAllMut.isPending}
            className="flex items-center gap-1 ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
          >
            {generateAllMut.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            Gerar Todos
          </button>
        </div>

        {/* Template picker dropdown */}
        {showTemplatePicker && (
          <TemplatePicker
            templates={templates}
            onSelect={(templateId) => generateMut.mutate(templateId)}
            isPending={generateMut.isPending}
          />
        )}

        {/* Current summary content */}
        {current && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-slate-200 text-sm font-semibold">{getLabel(current)}</h3>
              {current.model && (
                <span className="text-xs text-slate-500 bg-dd-elevated px-2 py-0.5 rounded">
                  {current.model}
                </span>
              )}
              {current.tokensUsed != null && (
                <span className="text-xs text-slate-500">{current.tokensUsed} tokens</span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => generateMut.mutate(current.templateId ?? undefined)}
                  disabled={generateMut.isPending}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                  title="Regenerar"
                >
                  <RefreshCw size={12} className={generateMut.isPending ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteMut.mutate(current.id)}
                  disabled={deleteMut.isPending}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-red-400 transition-colors"
                  title="Excluir resumo"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <div className="bg-dd-surface border border-dd-border rounded-xl p-5">
              <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                {current.text || (current as any).textMd}
              </p>
            </div>
          </div>
        )}

        {generateMut.isError && (
          <p className="text-red-400 text-xs mt-3">Erro ao gerar resumo.</p>
        )}
      </div>
    );
  }

  // No summaries — show template picker + generate
  const defaultTemplate = templates.find((t: SummaryTemplate) => t.isDefault);
  const effectiveTemplateId = selectedTemplateId ?? defaultTemplate?.id ?? null;

  return (
    <div>
      <p className="text-slate-400 text-sm mb-4">
        Selecione um template e gere o resumo desta reunião.
      </p>

      {templates.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {templates.map((t: SummaryTemplate) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTemplateId(t.id)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                effectiveTemplateId === t.id
                  ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                  : 'bg-dd-elevated text-slate-400 border-dd-border hover:border-indigo-500/30 hover:text-slate-200',
              ].join(' ')}
            >
              {t.name}
              {t.isDefault && ' *'}
            </button>
          ))}
        </div>
      )}

      {templates.length === 0 && (
        <p className="text-slate-500 text-xs mb-5">
          Nenhum template disponível. Crie um em Templates de Resumo.
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => generateMut.mutate(effectiveTemplateId ?? undefined)}
          disabled={generateMut.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {generateMut.isPending && <Loader2 size={14} className="animate-spin" />}
          Gerar Resumo
        </button>
        <button
          type="button"
          onClick={() => generateAllMut.mutate()}
          disabled={generateAllMut.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-dd-elevated hover:bg-dd-surface border border-dd-border text-slate-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {generateAllMut.isPending && <Loader2 size={14} className="animate-spin" />}
          <Sparkles size={14} />
          Gerar Todos (Tipo)
        </button>
      </div>

      {generateMut.isError && (
        <p className="text-red-400 text-xs mt-3">Erro ao gerar resumo. Tente novamente.</p>
      )}
    </div>
  );
}

// ─── Template Picker ────────────────────────────────────────────────────────

function TemplatePicker({
  templates,
  onSelect,
  isPending,
}: {
  templates: SummaryTemplate[];
  onSelect: (templateId: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="mb-4 bg-dd-elevated border border-dd-border rounded-lg p-3 space-y-1">
      <p className="text-xs text-slate-400 mb-2">Selecione um template:</p>
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          disabled={isPending}
          className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-dd-surface transition-colors disabled:opacity-50"
        >
          <span className="text-slate-200 font-medium">{t.name}</span>
          {t.description && (
            <span className="text-slate-500 truncate">{t.description}</span>
          )}
          {t.isDefault && (
            <span className="ml-auto text-indigo-400 text-[10px] shrink-0">padrão</span>
          )}
        </button>
      ))}
    </div>
  );
}
