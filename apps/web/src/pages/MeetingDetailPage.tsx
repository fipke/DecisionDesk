import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useMeetingDetail } from '../hooks/useMeetingDetail';
import type { MeetingStatus } from '../types';

// ─── Status badge (local, matches MeetingCard) ────────────────────────────────

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

// ─── Transcript parser ────────────────────────────────────────────────────────

/**
 * Pattern: optional hours, MM:SS, speaker name, text.
 * e.g. "00:01 João Silva: Bom dia a todos."
 *      "1:02:15 Maria: Vamos começar?"
 */
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

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'transcricao' | 'notas' | 'resumo';

const TABS: { id: Tab; label: string }[] = [
  { id: 'transcricao', label: 'Transcrição' },
  { id: 'notas', label: 'Notas' },
  { id: 'resumo', label: 'Resumo' },
];

// ─── Component ────────────────────────────────────────────────────────────────

/** Meeting detail page with 3 tabs: Transcrição, Notas, Resumo. */
export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: meeting, isLoading, isError } = useMeetingDetail(id);
  const [activeTab, setActiveTab] = useState<Tab>('transcricao');

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <p className="text-slate-500 text-sm">Carregando reunião...</p>
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <p className="text-red-400 text-sm">Reunião não encontrada.</p>
      </div>
    );
  }

  const title = meeting.title ?? 'Reunião';
  const dateStr = new Date(meeting.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Parse transcript lines
  const transcriptLines = meeting.transcriptText
    ? parseTranscript(meeting.transcriptText)
    : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
      {/* Header */}
      <div className="px-6 pt-5 pb-0 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={15} />
          Reuniões
        </button>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <h1 className="text-slate-100 text-xl font-semibold">{title}</h1>
          <StatusBadge status={meeting.status} />
        </div>
        <p className="text-slate-500 text-xs mb-4">{dateStr}</p>

        {/* Tab bar */}
        <div className="flex gap-1">
          {TABS.map(({ id: tabId, label }) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setActiveTab(tabId)}
              className={[
                'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                activeTab === tabId
                  ? 'text-emerald-400 border-emerald-500 bg-emerald-500/5'
                  : 'text-slate-400 border-transparent hover:text-slate-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* ── Transcrição ─────────────────────────────────────────── */}
        {activeTab === 'transcricao' && (
          <div>
            {transcriptLines.length === 0 ? (
              <p className="text-slate-500 text-sm">Nenhuma transcrição disponível.</p>
            ) : (
              <div className="space-y-3">
                {transcriptLines.map((line, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="text-slate-500 text-xs font-mono mt-0.5 w-14 shrink-0 text-right">
                      {line.timestamp}
                    </span>
                    <div className="flex-1">
                      <span className="text-emerald-400 text-xs font-semibold mr-2">
                        {line.speaker}:
                      </span>
                      <span className="text-slate-300 text-sm">{line.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Notas ───────────────────────────────────────────────── */}
        {activeTab === 'notas' && (
          <p className="text-slate-500 text-sm">Notas não disponíveis nesta versão web.</p>
        )}

        {/* ── Resumo ──────────────────────────────────────────────── */}
        {activeTab === 'resumo' && (
          <p className="text-slate-500 text-sm">Resumo não disponível nesta versão web.</p>
        )}
      </div>
    </div>
  );
}
