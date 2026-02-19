import { useNavigate } from 'react-router-dom';
import { Clock, DollarSign } from 'lucide-react';
import type { Meeting, MeetingStatus } from '../types';

// ─── Status badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: MeetingStatus;
}

const STATUS_CONFIG: Record<MeetingStatus, { label: string; classes: string }> = {
  NEW: { label: 'Novo', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PROCESSING: { label: 'Processando', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' },
  DONE: { label: 'Concluído', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ERROR: { label: 'Erro', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

/** Colored pill badge reflecting a meeting's transcription status. */
function StatusBadge({ status }: StatusBadgeProps) {
  const { label, classes } = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${classes}`}
    >
      {label}
    </span>
  );
}

// ─── Duration formatter ──────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Format a BRL currency value compactly, e.g. "R$ 1,23".
 * Returns null when the value is absent.
 */
function formatBrl(value: number | null | undefined): string | null {
  if (value == null) return null;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Format an ISO date string to a short Brazilian locale date + time. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Card component ───────────────────────────────────────────────────────────

interface MeetingCardProps {
  meeting: Meeting;
}

/** Compact card representing a single meeting in the list view. */
export function MeetingCard({ meeting }: MeetingCardProps) {
  const navigate = useNavigate();
  const title = meeting.title ?? 'Gravação';
  const brl = formatBrl(meeting.costBrl);

  return (
    <button
      type="button"
      onClick={() => navigate(`/meetings/${meeting.id}`)}
      className="w-full text-left bg-dd-surface hover:bg-dd-elevated/70 border border-dd-border rounded-xl px-4 py-3.5 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 text-sm font-medium truncate group-hover:text-white transition-colors">
            {title}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">{formatDate(meeting.createdAt)}</p>
        </div>
        <StatusBadge status={meeting.status} />
      </div>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        {meeting.meetingTypeName && (
          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-indigo-400 border border-indigo-500/20">
            {meeting.meetingTypeName}
          </span>
        )}
        {meeting.durationSec != null && meeting.durationSec > 0 && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatDuration(meeting.durationSec)}
          </span>
        )}
        {meeting.durationSec == null && meeting.minutes != null && meeting.minutes > 0 && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {meeting.minutes} min
          </span>
        )}
        {brl != null && (
          <span className="flex items-center gap-1">
            <DollarSign size={11} />
            {brl}
          </span>
        )}
      </div>
    </button>
  );
}
