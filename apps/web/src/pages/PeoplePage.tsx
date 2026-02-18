import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPeople } from '../services/api';
import type { Person } from '../types';

// ─── Avatar ───────────────────────────────────────────────────────────────────

/** Circle avatar showing the first letter of the person's display name. */
function Avatar({ name }: { name: string }) {
  const letter = name.charAt(0).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
      <span className="text-emerald-400 font-semibold text-sm">{letter}</span>
    </div>
  );
}

// ─── Person card ──────────────────────────────────────────────────────────────

function PersonCard({ person }: { person: Person }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 flex items-center gap-3">
      <Avatar name={person.displayName} />
      <div className="min-w-0 flex-1">
        <p className="text-slate-100 text-sm font-medium truncate">{person.displayName}</p>
        {person.fullName && person.fullName !== person.displayName && (
          <p className="text-slate-400 text-xs truncate">{person.fullName}</p>
        )}
        {person.email && (
          <p className="text-slate-500 text-xs truncate">{person.email}</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Participant directory with search filtering. */
export function PeoplePage() {
  const { data: people, isLoading, isError } = useQuery<Person[], Error>({
    queryKey: ['people'],
    queryFn: () => fetchPeople(),
    staleTime: 30_000,
  });

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!people) return [];
    const q = search.toLowerCase().trim();
    if (!q) return people;
    return people.filter((p) => {
      const name = p.displayName.toLowerCase();
      const email = (p.email ?? '').toLowerCase();
      const full = (p.fullName ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || full.includes(q);
    });
  }, [people, search]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-800 sticky top-0 z-10 bg-slate-950">
        <h1 className="text-slate-100 text-xl font-semibold mb-4">Pessoas</h1>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar pessoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <p className="text-slate-500 text-sm text-center py-12">Carregando pessoas...</p>
        )}

        {isError && (
          <p className="text-red-400 text-sm text-center py-12">
            Erro ao carregar pessoas. Verifique a conexão com o servidor.
          </p>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-12">Nenhuma pessoa encontrada</p>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <PersonCard key={p.id} person={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
