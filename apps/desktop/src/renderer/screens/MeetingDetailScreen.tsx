import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Meeting, MeetingStatus, NoteBlock, NoteBlockType } from '../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────

function statusBadge(status: MeetingStatus) {
  const configs: Record<MeetingStatus, { label: string; classes: string; pulse?: boolean }> = {
    PENDING_SYNC: { label: 'Pendente',    classes: 'bg-slate-700 text-slate-300' },
    NEW:          { label: 'Novo',        classes: 'bg-blue-700 text-blue-100' },
    PROCESSING:   { label: 'Processando', classes: 'bg-amber-600 text-amber-100', pulse: true },
    DONE:         { label: 'Concluído',   classes: 'bg-emerald-700 text-emerald-100' },
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

// ─── Transcript line parsing ──────────────────────────────────

interface TranscriptLine {
  hours: string | null;
  minutes: string;
  seconds: string;
  speaker: string;
  text: string;
}

const TRANSCRIPT_LINE_RE = /^(?:(\d+):)?(\d{2}):(\d{2})\s+([^:]+):\s+(.+)$/;

function parseTranscript(raw: string): TranscriptLine[] {
  const result: TranscriptLine[] = [];
  for (const line of raw.split('\n')) {
    const m = TRANSCRIPT_LINE_RE.exec(line.trim());
    if (!m) continue;
    result.push({
      hours:   m[1] ?? null,
      minutes: m[2],
      seconds: m[3],
      speaker: m[4].trim(),
      text:    m[5].trim(),
    });
  }
  return result;
}

function formatTimestamp(line: TranscriptLine): string {
  if (line.hours) return `${line.hours}:${line.minutes}:${line.seconds}`;
  return `${line.minutes}:${line.seconds}`;
}

// ─── Tab: Transcrição ─────────────────────────────────────────

function TranscriptionTab({ meeting }: { meeting: Meeting }) {
  const [search, setSearch] = useState('');

  if (!meeting.transcriptText) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <svg className="h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="mt-4 text-slate-400">Nenhuma transcrição disponível.</p>
      </div>
    );
  }

  const lines = parseTranscript(meeting.transcriptText);

  const filtered = lines.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return l.speaker.toLowerCase().includes(q) || l.text.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar na transcrição..."
          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
      </div>

      {/* Lines */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-500">Nenhum resultado encontrado.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((line, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-medium text-sm text-emerald-400">{line.speaker}</span>
                <span className="text-xs text-slate-500">{formatTimestamp(line)}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{line.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Notas ───────────────────────────────────────────────

const BLOCK_TYPE_CONFIG: Record<NoteBlockType, { label: string; classes: string }> = {
  action_item: { label: 'Ação',      classes: 'bg-emerald-950/60 text-emerald-400 border-emerald-800' },
  decision:    { label: 'Decisão',   classes: 'bg-amber-950/60 text-amber-400 border-amber-800' },
  paragraph:   { label: 'Parágrafo', classes: 'bg-slate-800 text-slate-400 border-slate-700' },
  heading:     { label: 'Título',    classes: 'bg-slate-800 text-slate-300 border-slate-700' },
  question:    { label: 'Pergunta',  classes: 'bg-blue-950/60 text-blue-400 border-blue-800' },
  reference:   { label: 'Referência',classes: 'bg-violet-950/60 text-violet-400 border-violet-800' },
};

function NoteBlockItem({ block }: { block: NoteBlock }) {
  const cfg = BLOCK_TYPE_CONFIG[block.blockType];
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
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
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
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
          className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 resize-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleAdd}
            disabled={!newContent.trim() || addBlockMutation.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
  const { data: summaries = [], isLoading } = useQuery({
    queryKey: ['summaries', meetingId],
    queryFn: () => window.electronAPI.db.listSummaries(meetingId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <svg className="h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="mt-4 text-slate-400">Resumo não disponível.</p>
        <button
          onClick={() => alert('Em breve')}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Gerar Resumo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((summary) => (
        <div key={summary.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
              {summary.style}
            </span>
          </div>
          <div className="prose prose-sm prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">
              {summary.bodyMarkdown}
            </pre>
          </div>
        </div>
      ))}
    </div>
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

  const { data: meeting, isLoading, error } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => window.electronAPI.db.getMeeting(id!),
    enabled: !!id,
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Reunião não encontrada</p>
          <button
            onClick={() => navigate('/meetings')}
            className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600 text-slate-100"
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
      <div className="border-b border-slate-800 bg-slate-950 px-6 py-4">
        {/* Back link */}
        <button
          onClick={() => navigate('/meetings')}
          className="mb-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Reuniões
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
                className="w-full rounded-md border border-emerald-600 bg-slate-800 px-2 py-1 text-xl font-bold text-slate-100 outline-none focus:ring-1 focus:ring-emerald-600"
              />
            ) : (
              <button
                onClick={startEditTitle}
                className="group flex items-center gap-2 text-left"
                title="Clique para editar"
              >
                <h2 className="text-xl font-bold text-slate-100">
                  {meeting.title ?? 'Reunião'}
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

            <p className="mt-1 text-sm text-slate-500">{formatDate(meeting.createdAt)}</p>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            {statusBadge(meeting.status)}

            {!meeting.transcriptText && (
              <button
                onClick={() => alert('Em breve: transcrição local')}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                Transcrever localmente
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex gap-1 border-b border-slate-800 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-emerald-500 text-emerald-400'
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
        {activeTab === 'transcript' && <TranscriptionTab meeting={meeting} />}
        {activeTab === 'notes'      && <NotesTab meetingId={meeting.id} />}
        {activeTab === 'summary'    && <SummaryTab meetingId={meeting.id} />}
      </div>
    </div>
  );
}
