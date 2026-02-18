import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Person } from '../../shared/types';

// ─── PersonCard ───────────────────────────────────────────────

function PersonCard({ person }: { person: Person }) {
  const initial = person.displayName.charAt(0).toUpperCase();

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex flex-col items-center text-center gap-3">
      {/* Avatar */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700 text-lg font-semibold text-white">
        {initial}
      </div>

      {/* Info */}
      <div className="min-w-0 w-full">
        <p className="font-medium text-slate-100 truncate">{person.displayName}</p>
        {person.fullName && person.fullName !== person.displayName && (
          <p className="text-sm text-slate-400 truncate">{person.fullName}</p>
        )}
        {person.email && (
          <p className="mt-0.5 text-xs text-slate-500 truncate">{person.email}</p>
        )}
      </div>
    </div>
  );
}

// ─── PeopleScreen ─────────────────────────────────────────────

export function PeopleScreen() {
  const [search, setSearch] = useState('');

  const { data: people = [], isLoading, error } = useQuery({
    queryKey: ['people'],
    queryFn: () => window.electronAPI.db.listPeople(),
  });

  const filtered = people.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q) ||
      (p.fullName ?? '').toLowerCase().includes(q)
    );
  });

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Erro ao carregar pessoas</p>
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
          <h2 className="text-2xl font-bold text-slate-100">Pessoas</h2>
          <p className="mt-1 text-sm text-slate-400">
            {people.length} participante{people.length !== 1 ? 's' : ''} registrado{people.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => alert('Em breve')}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Adicionar pessoa
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
          placeholder="Buscar por nome ou email..."
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 py-16">
          <svg className="h-16 w-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-slate-400">
            {search ? 'Nenhuma pessoa encontrada' : 'Nenhuma pessoa cadastrada'}
          </p>
          {!search && (
            <p className="mt-1 text-sm text-slate-500">
              Adicione participantes para associar às reuniões
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}
