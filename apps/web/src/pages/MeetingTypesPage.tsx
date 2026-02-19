import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, Loader2 } from 'lucide-react';
import {
  fetchMeetingTypes,
  createMeetingType,
  updateMeetingType,
  deleteMeetingType,
  fetchTemplates,
} from '../services/api';
import type { MeetingType, SummaryTemplate } from '../types';

// ─── Extraction config keys ──────────────────────────────────────────────────

const EXTRACTION_KEYS = [
  { key: 'action_items', label: 'Action Items' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'deadlines', label: 'Deadlines' },
  { key: 'backlog', label: 'Backlog' },
] as const;

const AI_PROVIDERS = ['openai', 'ollama'] as const;

// ─── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  icon: string;
  color: string;
  summaryTemplateIds: string[];
  extractionConfig: Record<string, boolean>;
  aiProvider: string;
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    icon: '',
    color: '#6366f1',
    summaryTemplateIds: [],
    extractionConfig: {
      action_items: false,
      decisions: false,
      deadlines: false,
      backlog: false,
    },
    aiProvider: 'openai',
  };
}

function meetingTypeToForm(mt: MeetingType): FormState {
  return {
    name: mt.name,
    description: mt.description ?? '',
    icon: mt.icon ?? '',
    color: mt.color ?? '#6366f1',
    summaryTemplateIds: mt.summaryTemplateIds ?? [],
    extractionConfig: {
      action_items: !!mt.extractionConfig?.action_items,
      decisions: !!mt.extractionConfig?.decisions,
      deadlines: !!mt.extractionConfig?.deadlines,
      backlog: !!mt.extractionConfig?.backlog,
    },
    aiProvider: mt.aiProvider ?? 'openai',
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MeetingTypesPage() {
  const queryClient = useQueryClient();

  const { data: meetingTypes = [], isLoading } = useQuery({
    queryKey: ['meetingTypes'],
    queryFn: fetchMeetingTypes,
  });

  const { data: templates = [] } = useQuery<SummaryTemplate[]>({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Mutations
  const createMut = useMutation({
    mutationFn: (f: FormState) =>
      createMeetingType({
        name: f.name,
        description: f.description || undefined,
        icon: f.icon || undefined,
        color: f.color || undefined,
        summaryTemplateIds: f.summaryTemplateIds,
        extractionConfig: f.extractionConfig,
        aiProvider: f.aiProvider,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingTypes'] });
      closeModal();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) =>
      updateMeetingType(id, {
        name: f.name,
        description: f.description || undefined,
        icon: f.icon || undefined,
        color: f.color || undefined,
        summaryTemplateIds: f.summaryTemplateIds,
        extractionConfig: f.extractionConfig,
        aiProvider: f.aiProvider,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingTypes'] });
      closeModal();
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteMeetingType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingTypes'] });
      setDeleteConfirmId(null);
    },
  });

  // Helpers
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(mt: MeetingType) {
    setEditingId(mt.id);
    setForm(meetingTypeToForm(mt));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      updateMut.mutate({ id: editingId, f: form });
    } else {
      createMut.mutate(form);
    }
  }

  function toggleTemplate(templateId: string) {
    setForm((prev) => {
      const ids = prev.summaryTemplateIds.includes(templateId)
        ? prev.summaryTemplateIds.filter((id) => id !== templateId)
        : [...prev.summaryTemplateIds, templateId];
      return { ...prev, summaryTemplateIds: ids };
    });
  }

  function toggleExtraction(key: string) {
    setForm((prev) => ({
      ...prev,
      extractionConfig: {
        ...prev.extractionConfig,
        [key]: !prev.extractionConfig[key],
      },
    }));
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-dd-base">
      {/* Header */}
      <div className="px-6 py-5 border-b border-dd-border flex items-center justify-between">
        <h1 className="text-slate-100 text-xl font-semibold">Tipos de Reuniao</h1>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          + Novo Tipo
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-slate-500 animate-spin" />
          </div>
        ) : meetingTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-slate-400 text-sm mb-1">Nenhum tipo de reuniao encontrado</p>
            <p className="text-slate-500 text-xs">
              Crie um tipo de reuniao para organizar suas reunioes.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meetingTypes.map((mt) => (
              <div
                key={mt.id}
                className="bg-dd-surface border border-dd-border rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-500/30 transition-colors"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Color dot */}
                    <span
                      className="shrink-0 w-3 h-3 rounded-full"
                      style={{ backgroundColor: mt.color ?? '#6366f1' }}
                    />
                    {/* Icon name */}
                    {mt.icon && (
                      <span className="text-slate-500 text-xs font-mono shrink-0">
                        {mt.icon}
                      </span>
                    )}
                    {/* Name */}
                    <h3 className="text-slate-100 text-sm font-semibold truncate">
                      {mt.name}
                    </h3>
                  </div>
                  {/* Template count badge */}
                  {mt.summaryTemplateIds && mt.summaryTemplateIds.length > 0 && (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {mt.summaryTemplateIds.length}{' '}
                      {mt.summaryTemplateIds.length === 1 ? 'template' : 'templates'}
                    </span>
                  )}
                </div>

                {/* Description */}
                {mt.description && (
                  <p className="text-slate-400 text-xs line-clamp-2">{mt.description}</p>
                )}

                {/* Meta */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                  {mt.aiProvider && (
                    <span className="bg-dd-elevated px-2 py-0.5 rounded capitalize">
                      {mt.aiProvider}
                    </span>
                  )}
                  {mt.extractionConfig &&
                    Object.entries(mt.extractionConfig)
                      .filter(([, v]) => !!v)
                      .map(([k]) => (
                        <span key={k} className="bg-dd-elevated px-2 py-0.5 rounded">
                          {k.replace(/_/g, ' ')}
                        </span>
                      ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-1 border-t border-dd-border">
                  <button
                    type="button"
                    onClick={() => openEdit(mt)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors"
                  >
                    <Edit2 size={12} />
                    Editar
                  </button>
                  <div className="flex-1" />
                  {deleteConfirmId === mt.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate(mt.id)}
                        disabled={deleteMut.isPending}
                        className="px-2 py-1 text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 rounded-md transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(mt.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-dd-surface border border-dd-border rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dd-border">
              <h2 className="text-slate-100 text-lg font-semibold">
                {editingId ? 'Editar Tipo de Reuniao' : 'Novo Tipo de Reuniao'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="Ex: Sprint Planning"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Descricao</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-y"
                  placeholder="Descricao opcional do tipo de reuniao"
                />
              </div>

              {/* Row: Icon + Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Icone</label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-full px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Ex: bar-chart"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Cor</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-dd-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="flex-1 px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                      placeholder="#6366f1"
                    />
                  </div>
                </div>
              </div>

              {/* Summary Templates checklist */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-2">
                  Templates de Resumo
                </label>
                {templates.length === 0 ? (
                  <p className="text-slate-500 text-xs">Nenhum template disponivel.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-dd-border bg-dd-elevated p-3">
                    {templates.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.summaryTemplateIds.includes(t.id)}
                          onChange={() => toggleTemplate(t.id)}
                          className="accent-indigo-500"
                        />
                        <span className="truncate">{t.name}</span>
                        {t.description && (
                          <span className="text-slate-500 text-xs truncate ml-auto">
                            {t.description}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Extraction Config */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-2">
                  Configuracao de Extracao
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EXTRACTION_KEYS.map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 cursor-pointer bg-dd-elevated border border-dd-border rounded-lg px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={!!form.extractionConfig[key]}
                        onChange={() => toggleExtraction(key)}
                        className="accent-indigo-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* AI Provider */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-2">
                  Provedor de IA
                </label>
                <div className="flex items-center gap-4">
                  {AI_PROVIDERS.map((provider) => (
                    <label
                      key={provider}
                      className="flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="aiProvider"
                        value={provider}
                        checked={form.aiProvider === provider}
                        onChange={(e) => setForm({ ...form, aiProvider: e.target.value })}
                        className="accent-indigo-500"
                      />
                      <span className="capitalize">{provider === 'openai' ? 'OpenAI' : 'Ollama'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
