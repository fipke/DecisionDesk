import { useMemo, useState } from 'react';
import { Search, Plus, X, Trash2, Edit3, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPeople, createPerson, updatePerson, deletePerson } from '../services/api';
import type { Person } from '../types';

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const letter = name.charAt(0).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
      <span className="text-indigo-400 font-semibold text-sm">{letter}</span>
    </div>
  );
}

// ─── Person Form Modal ────────────────────────────────────────────────────────

interface PersonFormProps {
  person?: Person | null;
  onClose: () => void;
}

function PersonFormModal({ person, onClose }: PersonFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!person;

  const [displayName, setDisplayName] = useState(person?.displayName ?? '');
  const [fullName, setFullName] = useState(person?.fullName ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [notes, setNotes] = useState(person?.notes ?? '');

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        displayName: displayName.trim(),
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      return isEditing
        ? updatePerson(person!.id, payload)
        : createPerson(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-dd-border bg-dd-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEditing ? 'Editar pessoa' : 'Adicionar pessoa'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nome de exibição *</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Ex: João"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Nome completo</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Ex: João da Silva"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="joao@exemplo.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              placeholder="Observações sobre esta pessoa..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!displayName.trim() || saveMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {isEditing ? 'Salvar' : 'Adicionar'}
          </button>
        </div>

        {saveMutation.isError && (
          <p className="mt-3 text-xs text-red-400">Erro ao salvar. Tente novamente.</p>
        )}
      </div>
    </div>
  );
}

// ─── Person card ──────────────────────────────────────────────────────────────

function PersonCard({ person, onEdit, onDelete }: { person: Person; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group bg-dd-surface border border-dd-border rounded-xl px-4 py-4 flex items-center gap-3 relative">
      <Avatar name={person.displayName} />
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onEdit}>
        <p className="text-slate-100 text-sm font-medium truncate">{person.displayName}</p>
        {person.fullName && person.fullName !== person.displayName && (
          <p className="text-slate-400 text-xs truncate">{person.fullName}</p>
        )}
        {person.email && (
          <p className="text-slate-500 text-xs truncate">{person.email}</p>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-dd-elevated">
          <Edit3 size={14} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-dd-elevated">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PeoplePage() {
  const queryClient = useQueryClient();
  const { data: people, isLoading, isError } = useQuery<Person[], Error>({
    queryKey: ['people'],
    queryFn: () => fetchPeople(),
    staleTime: 30_000,
  });

  const [search, setSearch] = useState('');
  const [modalPerson, setModalPerson] = useState<Person | null | undefined>(undefined); // undefined = closed, null = create, Person = edit
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePerson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setDeleteConfirm(null);
    },
  });

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
    <div className="flex-1 flex flex-col min-h-0 bg-dd-base">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-dd-border sticky top-0 z-10 bg-dd-base">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-slate-100 text-xl font-semibold">Pessoas</h1>
          <button
            onClick={() => setModalPerson(null)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <Plus size={16} />
            Adicionar pessoa
          </button>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar pessoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dd-surface border border-dd-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
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
              <PersonCard
                key={p.id}
                person={p}
                onEdit={() => setModalPerson(p)}
                onDelete={() => setDeleteConfirm(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {modalPerson !== undefined && (
        <PersonFormModal
          person={modalPerson}
          onClose={() => setModalPerson(undefined)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDeleteConfirm(null)}>
          <div className="rounded-2xl border border-dd-border bg-dd-surface p-6 shadow-2xl max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="text-slate-100 font-medium mb-2">Excluir pessoa?</p>
            <p className="text-slate-400 text-sm mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
