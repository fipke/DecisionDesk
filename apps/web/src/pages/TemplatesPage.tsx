import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2, Star, Edit3, X, Loader2 } from 'lucide-react';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
} from '../services/api';
import type { SummaryTemplate } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL_OPTIONS = ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] as const;
const FORMAT_OPTIONS = ['markdown', 'json', 'plain'] as const;

// ─── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  model: string;
  maxTokens: number;
  temperature: number;
  outputFormat: string;
  isDefault: boolean;
}

function emptyForm(): FormState {
  return {
    name: '',
    description: '',
    systemPrompt: '',
    userPromptTemplate: '',
    model: 'gpt-4o',
    maxTokens: 2048,
    temperature: 0.3,
    outputFormat: 'markdown',
    isDefault: false,
  };
}

function templateToForm(t: SummaryTemplate): FormState {
  return {
    name: t.name,
    description: t.description ?? '',
    systemPrompt: t.systemPrompt,
    userPromptTemplate: t.userPromptTemplate,
    model: t.model,
    maxTokens: t.maxTokens,
    temperature: t.temperature,
    outputFormat: t.outputFormat,
    isDefault: t.isDefault,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TemplatesPage() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
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
      createTemplate({
        name: f.name,
        description: f.description || undefined,
        systemPrompt: f.systemPrompt,
        userPromptTemplate: f.userPromptTemplate,
        model: f.model,
        maxTokens: f.maxTokens,
        temperature: f.temperature,
        outputFormat: f.outputFormat,
        isDefault: f.isDefault,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      closeModal();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) =>
      updateTemplate(id, {
        name: f.name,
        description: f.description || undefined,
        systemPrompt: f.systemPrompt,
        userPromptTemplate: f.userPromptTemplate,
        model: f.model,
        maxTokens: f.maxTokens,
        temperature: f.temperature,
        outputFormat: f.outputFormat,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      closeModal();
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setDeleteConfirmId(null);
    },
  });

  const setDefaultMut = useMutation({
    mutationFn: setDefaultTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  // Helpers
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(t: SummaryTemplate) {
    setEditingId(t.id);
    setForm(templateToForm(t));
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

  const isSaving = createMut.isPending || updateMut.isPending;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-dd-base">
      {/* Header */}
      <div className="px-6 py-5 border-b border-dd-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-indigo-400" />
          <h1 className="text-slate-100 text-xl font-semibold">Templates de Resumo</h1>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Novo Template
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-slate-500 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={40} className="text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm mb-1">Nenhum template encontrado</p>
            <p className="text-slate-500 text-xs">Crie um template para gerar resumos de reunioes.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="bg-dd-surface border border-dd-border rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-500/30 transition-colors"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-100 text-sm font-semibold truncate">{t.name}</h3>
                    {t.description && (
                      <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                  {t.isDefault && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Star size={10} />
                      Padrao
                    </span>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="bg-dd-elevated px-2 py-0.5 rounded">{t.model}</span>
                  <span>{t.outputFormat}</span>
                  <span>temp {t.temperature}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-1 border-t border-dd-border">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors"
                  >
                    <Edit3 size={12} />
                    Editar
                  </button>
                  {!t.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultMut.mutate(t.id)}
                      disabled={setDefaultMut.isPending}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors"
                    >
                      <Star size={12} />
                      Definir como padrao
                    </button>
                  )}
                  <div className="flex-1" />
                  {deleteConfirmId === t.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate(t.id)}
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
                      onClick={() => setDeleteConfirmId(t.id)}
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
                {editingId ? 'Editar Template' : 'Novo Template'}
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
                  placeholder="Ex: Resumo Executivo"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">Descricao</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="Descricao opcional"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">System Prompt</label>
                <textarea
                  required
                  rows={4}
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  className="w-full px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-y"
                  placeholder="Instrucoes de sistema para o modelo..."
                />
              </div>

              {/* User Prompt Template */}
              <div>
                <label className="block text-slate-300 text-xs font-medium mb-1">User Prompt Template</label>
                <textarea
                  required
                  rows={4}
                  value={form.userPromptTemplate}
                  onChange={(e) => setForm({ ...form, userPromptTemplate: e.target.value })}
                  className="w-full px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-y"
                  placeholder="Use {{transcript}} para inserir a transcricao..."
                />
                <p className="text-slate-500 text-xs mt-1">
                  Use <code className="text-indigo-400 bg-dd-elevated px-1 rounded">{'{{transcript}}'}</code> para inserir a transcricao da reuniao.
                </p>
              </div>

              {/* Row: Model + Output Format */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Modelo</label>
                  <select
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Formato de Saida</label>
                  <select
                    value={form.outputFormat}
                    onChange={(e) => setForm({ ...form, outputFormat: e.target.value })}
                    className="w-full px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {FORMAT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row: Max Tokens + Temperature */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Max Tokens</label>
                  <input
                    type="number"
                    min={100}
                    max={16000}
                    step={100}
                    value={form.maxTokens}
                    onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-dd-elevated border border-dd-border rounded-lg text-slate-100 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">
                    Temperature: {form.temperature.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.temperature}
                    onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                    className="w-full accent-indigo-500 mt-1"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                    <span>0</span>
                    <span>1</span>
                  </div>
                </div>
              </div>

              {/* Default checkbox (only on create) */}
              {!editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="accent-indigo-500"
                  />
                  <label htmlFor="isDefault" className="text-slate-300 text-sm">
                    Definir como template padrao
                  </label>
                </div>
              )}

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
