import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart3, Clock, Loader2, Calendar, Activity } from 'lucide-react';
import { fetchStats, fetchCalendar, fetchMeetings } from '../services/api';
import type { MeetingStatus } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert total minutes into a human-readable "Xh Ym" string. */
function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Return ISO date strings (YYYY-MM-DD) for Monday and Sunday of the current week. */
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

/** Build an array of 7 days (Mon-Sun) for the current week with meeting counts. */
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

/** Status badge config matching the existing MeetingCard component style. */
const STATUS_CONFIG: Record<MeetingStatus, { label: string; classes: string }> = {
  NEW: { label: 'Novo', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PROCESSING: { label: 'Processando', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' },
  DONE: { label: 'Concluido', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ERROR: { label: 'Erro', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

/** Format an ISO date to Brazilian locale. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

/** Dashboard page with stats cards, weekly calendar, and recent meetings. */
export function DashboardPage() {
  const { from, to } = useMemo(() => getCurrentWeekRange(), []);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 30_000,
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ['stats', 'calendar', from, to],
    queryFn: () => fetchCalendar(from, to),
  });

  const { data: meetings, isLoading: meetingsLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: fetchMeetings,
  });

  // Take the 5 most recent meetings, sorted newest first.
  const recentMeetings = useMemo(() => {
    if (!meetings) return [];
    return [...meetings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [meetings]);

  const weekDays = useMemo(() => buildWeekDays(from, calendarData), [from, calendarData]);

  // ── Stats cards config ─────────────────────────────────────────────────────

  const cards = [
    {
      label: 'Reunioes',
      value: stats?.totalMeetings ?? '--',
      icon: <BarChart3 size={20} className="text-indigo-400" />,
      accent: 'text-slate-100',
    },
    {
      label: 'Gravadas',
      value: stats ? formatMinutes(stats.totalMinutesRecorded) : '--',
      icon: <Clock size={20} className="text-indigo-400" />,
      accent: 'text-slate-100',
    },
    {
      label: 'Processando',
      value: stats?.pendingProcessing ?? '--',
      icon: <Loader2 size={20} className={`text-amber-400 ${(stats?.pendingProcessing ?? 0) > 0 ? 'animate-spin' : ''}`} />,
      accent: (stats?.pendingProcessing ?? 0) > 0 ? 'text-amber-400' : 'text-slate-100',
    },
    {
      label: 'Esta Semana',
      value: stats?.thisWeekCount ?? '--',
      icon: <Activity size={20} className="text-indigo-400" />,
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
            <Loader2 size={24} className="animate-spin text-indigo-400" />
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
            <Calendar size={16} className="text-indigo-400" />
            <h2 className="text-slate-100 text-sm font-semibold">Esta Semana</h2>
          </div>

          {calendarLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="flex items-end justify-between gap-2">
              {weekDays.map((day) => (
                <div key={day.date} className="flex flex-col items-center gap-2 flex-1">
                  {/* Count label */}
                  <span className="text-xs text-slate-500 h-4">
                    {day.count > 0 ? day.count : ''}
                  </span>

                  {/* Circle */}
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

                  {/* Day label */}
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
              <Loader2 size={18} className="animate-spin text-slate-500" />
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
