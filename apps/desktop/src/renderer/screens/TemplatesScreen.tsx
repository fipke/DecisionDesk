import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ───────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  isDefault: boolean;
  description?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  outputFormat?: string;
}

interface TemplateFormData {
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  model: string;
  maxTokens: number;
  temperature: number;
  outputFormat: string;
}

const EMPTY_FORM: TemplateFormData = {
  name: '',
  description: '',
  systemPrompt: '',
  userPromptTemplate: '',
  model: 'gpt-4o',
  maxTokens: 2048,
  temperature: 0.3,
  outputFormat: 'markdown',
};

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

const OUTPUT_FORMAT_OPTIONS = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'plain', label: 'Texto simples' },
];

// ─── Template Card ───────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div
      onClick={onEdit}
      className="group relative cursor-pointer rounded-xl border border-dd-border bg-dd-surface p-5 transition-colors hover:border-indigo-500/40 hover:bg-dd-elevated/70"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium text-slate-100">{template.name}</h3>
            {template.isDefault && (
              <span title="Template padrão" className="text-amber-400">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </span>
            )}
          </div>
          {template.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-400">{template.description}</p>
          )}
        </div>

        {/* Delete button (visible on hover) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex-shrink-0 rounded-md p-1.5 text-slate-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
          title="Excluir template"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Footer metadata */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400 border border-indigo-500/20">
          {template.model ?? 'gpt-4o'}
        </span>
        {template.outputFormat && (
          <span className="rounded-full bg-dd-elevated px-2 py-0.5 text-xs text-slate-400 border border-dd-border">
            {template.outputFormat}
          </span>
        )}
        {!template.isDefault && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetDefault();
            }}
            className="ml-auto rounded-md px-2 py-0.5 text-xs text-slate-500 opacity-0 transition-all hover:bg-amber-500/10 hover:text-amber-400 group-hover:opacity-100"
            title="Definir como padrão"
          >
            Definir padrão
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Template Modal ──────────────────────────────────────────

function TemplateModal({
  initial,
  onClose,
  onSave,
  isSaving,
}: {
  initial: TemplateFormData;
  onClose: () => void;
  onSave: (data: TemplateFormData) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<TemplateFormData>(initial);

  const isEditing = initial.name !== '';
  const isValid = form.name.trim() !== '' && form.systemPrompt.trim() !== '' && form.userPromptTemplate.trim() !== '';

  const update = <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-dd-border bg-dd-surface shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-dd-border bg-dd-surface px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-100">
            {isEditing ? 'Editar Template' : 'Novo Template'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-dd-elevated hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-5 px-6 py-5">
          {/* Nome */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Ex: Resumo executivo"
              className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Descrição</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Breve descrição do template"
              className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Prompt do sistema */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Prompt do sistema <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => update('systemPrompt', e.target.value)}
              placeholder="Instruções de sistema para o modelo..."
              rows={4}
              className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Template do prompt do usuário */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Template do prompt do usuário <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.userPromptTemplate}
              onChange={(e) => update('userPromptTemplate', e.target.value)}
              placeholder="Template com variáveis como {{transcription}}..."
              rows={4}
              className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Row: Modelo + Formato de saída */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Modelo</label>
              <select
                value={form.model}
                onChange={(e) => update('model', e.target.value)}
                className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Formato de saída</label>
              <select
                value={form.outputFormat}
                onChange={(e) => update('outputFormat', e.target.value)}
                className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Tokens máximos + Temperatura */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Tokens máximos</label>
              <input
                type="number"
                value={form.maxTokens}
                onChange={(e) => update('maxTokens', Number(e.target.value))}
                min={1}
                className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Temperatura</label>
              <input
                type="number"
                value={form.temperature}
                onChange={(e) => update('temperature', Number(e.target.value))}
                min={0}
                max={1}
                step={0.1}
                className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-dd-border bg-dd-surface px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-dd-border bg-transparent px-4 py-2 text-sm font-medium text-slate-300 hover:bg-dd-elevated"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!isValid || isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Salvando...
              </span>
            ) : isEditing ? (
              'Salvar alterações'
            ) : (
              'Criar template'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ───────────────────────────────

function DeleteConfirmModal({
  templateName,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  templateName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-dd-border bg-dd-surface p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100">Excluir template</h3>
        <p className="mt-2 text-sm text-slate-400">
          Tem certeza que deseja excluir o template <strong className="text-slate-200">"{templateName}"</strong>?
          Esta ação não pode ser desfeita.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-dd-border bg-transparent px-4 py-2 text-sm font-medium text-slate-300 hover:bg-dd-elevated"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TemplatesScreen ─────────────────────────────────────────

export function TemplatesScreen() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['templates'],
    queryFn: () => window.electronAPI.api.fetchTemplates(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TemplateFormData) =>
      window.electronAPI.api.createTemplate(payload as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['api-templates'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TemplateFormData }) =>
      window.electronAPI.api.updateTemplate(id, payload as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['api-templates'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.electronAPI.api.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['api-templates'] });
      setDeletingTemplate(null);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => window.electronAPI.api.setDefaultTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['api-templates'] });
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingTemplate(null);
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const openEdit = (template: Template) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };

  const handleSave = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, payload: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const initialForm: TemplateFormData = editingTemplate
    ? {
        name: editingTemplate.name,
        description: editingTemplate.description ?? '',
        systemPrompt: editingTemplate.systemPrompt ?? '',
        userPromptTemplate: editingTemplate.userPromptTemplate ?? '',
        model: editingTemplate.model ?? 'gpt-4o',
        maxTokens: editingTemplate.maxTokens ?? 2048,
        temperature: editingTemplate.temperature ?? 0.3,
        outputFormat: editingTemplate.outputFormat ?? 'markdown',
      }
    : EMPTY_FORM;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Erro ao carregar templates</p>
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
          <h2 className="text-2xl font-bold text-slate-100">Templates</h2>
          <p className="mt-1 text-sm text-slate-400">
            {templates.length} template{templates.length !== 1 ? 's' : ''} de resumo
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Template
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dd-border bg-dd-surface/50 py-16">
          <svg className="h-16 w-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-slate-400">Nenhum template ainda</p>
          <p className="mt-1 text-sm text-slate-500">Crie um template para gerar resumos personalizados</p>
          <button
            onClick={openCreate}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Criar primeiro template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => openEdit(template)}
              onDelete={() => setDeletingTemplate(template)}
              onSetDefault={() => setDefaultMutation.mutate(template.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <TemplateModal
          initial={initialForm}
          onClose={closeModal}
          onSave={handleSave}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      {deletingTemplate && (
        <DeleteConfirmModal
          templateName={deletingTemplate.name}
          onConfirm={() => deleteMutation.mutate(deletingTemplate.id)}
          onCancel={() => setDeletingTemplate(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
