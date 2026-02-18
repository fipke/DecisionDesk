import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useMeetings } from '../hooks/useMeetings';
import { MeetingCard } from '../components/MeetingCard';
import type { Meeting } from '../types';

// ─── Date grouping helpers ────────────────────────────────────────────────────

/** Returns a group label for an ISO date string relative to today. */
function getGroupLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'Hoje';
  if (sameDay(date, yesterday)) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** Groups an ordered list of meetings by date label. */
function groupByDate(meetings: Meeting[]): [string, Meeting[]][] {
  const map = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const label = getGroupLabel(m.createdAt);
    const group = map.get(label) ?? [];
    group.push(m);
    map.set(label, group);
  }
  return Array.from(map.entries());
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Main meeting list page with search and date-grouped cards. */
export function MeetingsPage() {
  const { data: meetings, isLoading, isError } = useMeetings();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!meetings) return [];
    const q = search.toLowerCase().trim();
    if (!q) return meetings;
    return meetings.filter((m) => {
      const title = (m.title ?? 'reunião').toLowerCase();
      return title.includes(q);
    });
  }, [meetings, search]);

  // Sort newest first before grouping
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered],
  );

  const groups = useMemo(() => groupByDate(sorted), [sorted]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
        <h1 className="text-slate-100 text-xl font-semibold mb-4">Reuniões</h1>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar reunião..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className="text-slate-500 text-sm text-center py-12">Carregando reuniões...</div>
        )}

        {isError && (
          <div className="text-red-400 text-sm text-center py-12">
            Erro ao carregar reuniões. Verifique a conexão com o servidor.
          </div>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-12">Nenhuma reunião ainda</div>
        )}

        {groups.map(([label, items]) => (
          <section key={label} className="mb-6">
            <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
              {label}
            </h2>
            <div className="space-y-2">
              {items.map((m) => (
                <MeetingCard key={m.id} meeting={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
