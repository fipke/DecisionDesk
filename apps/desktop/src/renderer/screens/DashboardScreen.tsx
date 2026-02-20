import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Meeting, MeetingStatus } from '../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getCurrentWeekRange(): { from: string; to: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(monday), to: fmt(sunday) };
}

function buildWeekDays(from: string, calendarData: { day: string; count: number }[] | undefined) {
  const monday = new Date(from + 'T00:00:00');
  const countMap = new Map<string, number>();
  if (calendarData) {
    for (const entry of calendarData) {
      countMap.set(entry.day, entry.count);
    }
  }

  const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const days: { label: string; date: string; count: number; isToday: boolean }[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({
      label: DAY_LABELS[i],
      date: dateStr,
      count: countMap.get(dateStr) ?? 0,
      isToday: dateStr === todayStr,
    });
  }
  return days;
}

const STATUS_CONFIG: Record<MeetingStatus, { label: string; classes: string }> = {
  PENDING_SYNC: { label: 'Pendente', classes: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  NEW: { label: 'Novo', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PROCESSING: { label: 'Processando', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' },
  DONE: { label: 'Concluido', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ERROR: { label: 'Erro', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Icons (inline SVGs) ────────────────────────────────────────────────────

function BarChartIcon() {
  return (
    <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SpinnerIcon({ animate }: { animate?: boolean }) {
  return (
    <svg className={`h-5 w-5 text-amber-400 ${animate ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DashboardScreen() {
  const { from, to } = useMemo(() => getCurrentWeekRange(), []);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ['stats'],
    queryFn: () => window.electronAPI.api.fetchStats(),
    refetchInterval: 30_000,
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ['stats', 'calendar', from, to],
    queryFn: () => window.electronAPI.api.fetchCalendar(from, to),
  });

  const { data: meetings, isLoading: meetingsLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const [local, remote] = await Promise.all([
        window.electronAPI.db.listMeetings(),
        window.electronAPI.api.fetchMeetings().catch(() => [] as Meeting[]),
      ]);
      const merged = new Map<string, Meeting>();
      for (const m of remote) merged.set(m.id, m);
      for (const m of local) {
        const r = merged.get(m.id);
        if (r) {
          merged.set(m.id, {
            ...r,
            recordingUri: m.recordingUri ?? r.recordingUri,
            transcriptText: r.transcriptText || m.transcriptText || null,
            status: r.transcriptText ? r.status : (m.transcriptText ? m.status : r.status),
          });
        } else {
          merged.set(m.id, m);
        }
      }
      return Array.from(merged.values());
    },
  });

  const recentMeetings = useMemo(() => {
    if (!meetings) return [];
    return [...meetings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [meetings]);

  const weekDays = useMemo(() => buildWeekDays(from, calendarData), [from, calendarData]);

  const cards = [
    {
      label: 'Reunioes',
      value: stats?.totalMeetings ?? '--',
      icon: <BarChartIcon />,
      accent: 'text-slate-100',
    },
    {
      label: 'Gravadas',
      value: stats ? formatMinutes(stats.totalMinutesRecorded) : '--',
      icon: <ClockIcon />,
      accent: 'text-slate-100',
    },
    {
      label: 'Processando',
      value: stats?.pendingProcessing ?? '--',
      icon: <SpinnerIcon animate={(stats?.pendingProcessing ?? 0) > 0} />,
      accent: (stats?.pendingProcessing ?? 0) > 0 ? 'text-amber-400' : 'text-slate-100',
    },
    {
      label: 'Esta Semana',
      value: stats?.thisWeekCount ?? '--',
      icon: <ActivityIcon />,
      accent: 'text-slate-100',
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-dd-base">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-dd-border bg-dd-base sticky top-0 z-10">
        <h1 className="text-slate-100 text-xl font-semibold">Dashboard</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Stats cards */}
        {statsLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="h-6 w-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="ml-2 text-sm text-slate-500">Carregando estatisticas...</span>
          </div>
        ) : statsError ? (
          <div className="text-red-400 text-sm text-center py-8">
            Erro ao carregar estatisticas. Verifique a conexao com o servidor.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className="bg-dd-surface border border-dd-border rounded-xl p-5 flex items-start gap-4"
              >
                <div className="rounded-lg bg-indigo-500/10 p-2.5">{card.icon}</div>
                <div>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className={`text-2xl font-semibold mt-1 ${card.accent}`}>{card.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Weekly calendar */}
        <div className="bg-dd-surface border border-dd-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon />
            <h2 className="text-slate-100 text-sm font-semibold">Esta Semana</h2>
          </div>

          {calendarLoading ? (
            <div className="flex items-center justify-center py-6">
              <svg className="h-5 w-5 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-2">
              {weekDays.map((day) => (
                <div key={day.date} className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-xs text-slate-500 h-4">
                    {day.count > 0 ? day.count : ''}
                  </span>
                  <div
                    className={[
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                      day.count > 0
                        ? 'bg-indigo-500 text-white'
                        : day.isToday
                          ? 'border-2 border-indigo-500 text-indigo-400 bg-transparent'
                          : 'bg-dd-elevated text-slate-500',
                    ].join(' ')}
                  >
                    {day.count > 0 ? day.count : ''}
                  </div>
                  <span
                    className={`text-xs font-medium ${day.isToday ? 'text-indigo-400' : 'text-slate-500'}`}
                  >
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent meetings */}
        <div className="bg-dd-surface border border-dd-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-slate-100 text-sm font-semibold">Reunioes Recentes</h2>
            <Link
              to="/meetings"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Ver todas
            </Link>
          </div>

          {meetingsLoading ? (
            <div className="flex items-center justify-center py-6">
              <svg className="h-5 w-5 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : recentMeetings.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Nenhuma reuniao encontrada</p>
          ) : (
            <div className="space-y-2">
              {recentMeetings.map((m) => {
                const { label, classes } = STATUS_CONFIG[m.status];
                return (
                  <Link
                    key={m.id}
                    to={`/meetings/${m.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-dd-base hover:bg-dd-elevated/70 border border-dd-border transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-100 text-sm font-medium truncate group-hover:text-white transition-colors">
                        {m.title ?? 'Gravacao'}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">{formatDate(m.createdAt)}</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${classes}`}
                    >
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
