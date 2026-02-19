import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Person } from '../../shared/types';

// ─── Types ───────────────────────────────────────────────────

interface PersonFormData {
  displayName: string;
  fullName: string;
  email: string;
  notes: string;
}

const emptyForm: PersonFormData = {
  displayName: '',
  fullName: '',
  email: '',
  notes: '',
};

// ─── PersonModal ─────────────────────────────────────────────

function PersonModal({
  person,
  onClose,
  onSave,
  saving,
}: {
  person: Person | null;
  onClose: () => void;
  onSave: (data: PersonFormData) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<PersonFormData>(() =>
    person
      ? {
          displayName: person.displayName,
          fullName: person.fullName ?? '',
          email: person.email ?? '',
          notes: person.notes ?? '',
        }
      : { ...emptyForm },
  );

  const isEdit = !!person;
  const canSave = form.displayName.trim().length > 0 && !saving;

  const handleField = (field: keyof PersonFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSave) onSave(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-dd-border bg-dd-elevated p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">
            {isEdit ? 'Editar pessoa' : 'Adicionar pessoa'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-dd-surface hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* displayName (required) */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">
              Nome de exibi&ccedil;&atilde;o <span className="text-red-400">*</span>
            </span>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => handleField('displayName', e.target.value)}
              placeholder="Ex: João Silva"
              required
              autoFocus
              className="rounded-lg border border-dd-border bg-dd-surface px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          {/* fullName */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">Nome completo</span>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => handleField('fullName', e.target.value)}
              placeholder="Ex: João Carlos da Silva"
              className="rounded-lg border border-dd-border bg-dd-surface px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          {/* email */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleField('email', e.target.value)}
              placeholder="joao@exemplo.com"
              className="rounded-lg border border-dd-border bg-dd-surface px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          {/* notes */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">Notas</span>
            <textarea
              value={form.notes}
              onChange={(e) => handleField('notes', e.target.value)}
              placeholder="Observações sobre este participante..."
              rows={3}
              className="resize-none rounded-lg border border-dd-border bg-dd-surface px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          {/* Actions */}
          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-dd-border px-4 py-2 text-sm font-medium text-slate-300 hover:bg-dd-surface"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── PersonCard ──────────────────────────────────────────────

function PersonCard({
  person,
  onEdit,
  onDelete,
}: {
  person: Person;
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
}) {
  const initial = person.displayName.charAt(0).toUpperCase();

  return (
    <div
      className="group relative cursor-pointer rounded-xl border border-dd-border bg-dd-surface p-4 flex flex-col items-center text-center gap-3 transition-colors hover:border-indigo-500/40"
      onClick={() => onEdit(person)}
    >
      {/* Delete button — visible on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(person);
        }}
        title="Remover pessoa"
        className="absolute right-2 top-2 rounded-md p-1 text-slate-600 opacity-0 transition-opacity hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Avatar */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-700 text-lg font-semibold text-white">
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

// ─── DeleteConfirmModal ──────────────────────────────────────

function DeleteConfirmModal({
  person,
  onClose,
  onConfirm,
  deleting,
}: {
  person: Person;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-dd-border bg-dd-elevated p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100">Remover pessoa</h3>
        <p className="mt-2 text-sm text-slate-400">
          Tem certeza que deseja remover{' '}
          <span className="font-medium text-slate-200">{person.displayName}</span>? Esta
          ação não pode ser desfeita.
        </p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-dd-border px-4 py-2 text-sm font-medium text-slate-300 hover:bg-dd-surface"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? 'Removendo...' : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PeopleScreen ────────────────────────────────────────────

export function PeopleScreen() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [deletingPerson, setDeletingPerson] = useState<Person | null>(null);

  const queryClient = useQueryClient();

  const { data: people = [], isLoading, error } = useQuery({
    queryKey: ['people'],
    queryFn: () => window.electronAPI.db.listPeople(),
  });

  // ── Upsert mutation ──────────────────────────────────────

  const upsertMutation = useMutation({
    mutationFn: async (data: PersonFormData & { id?: string }) => {
      const payload = {
        displayName: data.displayName.trim(),
        fullName: data.fullName.trim() || undefined,
        email: data.email.trim() || undefined,
        notes: data.notes.trim() || undefined,
        ...(data.id ? { id: data.id } : {}),
      };

      const saved = await window.electronAPI.db.upsertPerson(payload);

      // Sync to backend (fire-and-forget with catch)
      try {
        if (data.id) {
          await window.electronAPI.api.updatePerson(data.id, payload);
        } else {
          await window.electronAPI.api.createPerson(payload);
        }
      } catch {
        // Backend sync failure is non-blocking; local DB is source of truth
      }

      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      closeModal();
    },
  });

  // ── Delete mutation ──────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await window.electronAPI.db.deletePerson(id);

      try {
        await window.electronAPI.api.deletePerson(id);
      } catch {
        // Backend sync failure is non-blocking
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setDeletingPerson(null);
    },
  });

  // ── Handlers ─────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditingPerson(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((person: Person) => {
    setEditingPerson(person);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingPerson(null);
  }, []);

  const handleSave = useCallback(
    (data: PersonFormData) => {
      upsertMutation.mutate({
        ...data,
        ...(editingPerson ? { id: editingPerson.id } : {}),
      });
    },
    [editingPerson, upsertMutation],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (deletingPerson) {
      deleteMutation.mutate(deletingPerson.id);
    }
  }, [deletingPerson, deleteMutation]);

  // ── Filter ───────────────────────────────────────────────

  const filtered = people.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q) ||
      (p.fullName ?? '').toLowerCase().includes(q)
    );
  });

  // ── Error state ──────────────────────────────────────────

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
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
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
          className="w-full rounded-lg border border-dd-border bg-dd-surface py-2.5 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-dd-border border-t-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dd-border bg-dd-surface/50 py-16">
          <svg className="h-16 w-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-slate-400">
            {search ? 'Nenhuma pessoa encontrada' : 'Nenhuma pessoa cadastrada'}
          </p>
          {!search && (
            <p className="mt-1 text-sm text-slate-500">
              Adicione participantes para associar às gravações
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              onEdit={openEdit}
              onDelete={setDeletingPerson}
            />
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <PersonModal
          person={editingPerson}
          onClose={closeModal}
          onSave={handleSave}
          saving={upsertMutation.isPending}
        />
      )}

      {/* Delete confirmation modal */}
      {deletingPerson && (
        <DeleteConfirmModal
          person={deletingPerson}
          onClose={() => setDeletingPerson(null)}
          onConfirm={handleDeleteConfirm}
          deleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
