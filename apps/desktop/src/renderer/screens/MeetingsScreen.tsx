import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Meeting, MeetingStatus } from '../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (startOfDate.getTime() === startOfToday.getTime()) return 'Hoje';
  if (startOfDate.getTime() === startOfYesterday.getTime()) return 'Ontem';

  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function groupMeetingsByDate(meetings: Meeting[]): Map<string, Meeting[]> {
  const groups = new Map<string, Meeting[]>();
  for (const meeting of meetings) {
    const label = formatRelativeDate(meeting.createdAt);
    const existing = groups.get(label) ?? [];
    existing.push(meeting);
    groups.set(label, existing);
  }
  return groups;
}

function statusBadge(status: MeetingStatus) {
  const configs: Record<MeetingStatus, { label: string; classes: string; pulse?: boolean }> = {
    PENDING_SYNC: { label: 'Pendente', classes: 'bg-slate-700 text-slate-300' },
    NEW:          { label: 'Novo',     classes: 'bg-blue-700 text-blue-100' },
    PROCESSING:   { label: 'Processando', classes: 'bg-amber-600 text-amber-100', pulse: true },
    DONE:         { label: 'Concluído',   classes: 'bg-emerald-700 text-emerald-100' },
    ERROR:        { label: 'Erro',        classes: 'bg-red-700 text-red-100' },
  };
  const cfg = configs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
      {cfg.pulse && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {cfg.label}
    </span>
  );
}

// ─── MeetingCard ─────────────────────────────────────────────

function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const title = meeting.title ?? 'Reunião';
  const time = formatTime(meeting.createdAt);
  const duration = meeting.minutes != null ? `${meeting.minutes} min` : null;
  const cost = meeting.costBrl != null
    ? `R$ ${meeting.costBrl.toFixed(2).replace('.', ',')}`
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition-colors hover:border-slate-700 hover:bg-slate-800/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-100">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{time}</span>
            {duration && <span>· {duration}</span>}
            {cost && <span>· {cost}</span>}
          </div>
        </div>
        <div className="flex-shrink-0 pt-0.5">
          {statusBadge(meeting.status)}
        </div>
      </div>
    </button>
  );
}

// ─── MeetingsScreen ──────────────────────────────────────────

export function MeetingsScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: meetings = [], isLoading, error } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => window.electronAPI.db.listMeetings(),
  });

  const filtered = meetings.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.title ?? '').toLowerCase().includes(q) ||
      (m.transcriptText ?? '').toLowerCase().includes(q)
    );
  });

  // Sort newest first, then group
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const groups = groupMeetingsByDate(sorted);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Erro ao carregar reuniões</p>
          <p className="mt-1 text-sm text-slate-500">{String(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Reuniões</h2>
          <p className="mt-1 text-sm text-slate-400">
            {meetings.length} reunião{meetings.length !== 1 ? 'es' : ''} registrada{meetings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['meetings'] })}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
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
          placeholder="Buscar reuniões..."
          className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 py-16">
          <svg className="h-16 w-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-slate-400">
            {search ? 'Nenhuma reunião encontrada' : 'Nenhuma reunião ainda'}
          </p>
          {search && (
            <p className="mt-1 text-sm text-slate-500">Tente outros termos de busca</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([label, group]) => (
            <section key={label}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {label}
              </h3>
              <div className="space-y-2">
                {group.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onClick={() => navigate(`/meetings/${meeting.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
