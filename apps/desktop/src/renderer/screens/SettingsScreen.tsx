import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../ThemeContext';

interface Settings {
  apiUrl: string;
  whisperModel: string;
  enableDiarization: boolean;
  huggingfaceToken?: string;
  autoAcceptJobs: boolean;
  notificationsEnabled: boolean;
  preferLocal: boolean;
}

// ─── AI Settings types (matches backend REST API) ────────────────────────────

interface AiTaskConfig {
  provider: string;
  model: string;
}

interface AiSettingsConfig {
  summarization: AiTaskConfig;
  extraction: AiTaskConfig;
  chat: AiTaskConfig;
  openaiEnabled: boolean;
}

interface AiSettingsResponse {
  config: AiSettingsConfig;
  ollamaAvailable: boolean;
}

interface OllamaModel {
  name: string;
  sizeBytes: number;
  parameterSize: string;
}

interface OllamaStatus {
  running: boolean;
  models: OllamaModel[];
}

// ─── AI Settings fetch helpers (direct fetch, no IPC) ────────────────────────

const AI_BASE = 'http://localhost:8087/api/v1';

async function fetchAiSettings(): Promise<AiSettingsResponse> {
  const res = await fetch(`${AI_BASE}/settings/ai`);
  if (!res.ok) throw new Error(`AI settings fetch failed: ${res.status}`);
  return res.json();
}

async function saveAiSettings(config: AiSettingsConfig): Promise<AiSettingsResponse> {
  const res = await fetch(`${AI_BASE}/settings/ai`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`AI settings save failed: ${res.status}`);
  return res.json();
}

// Ollama runs locally on the same machine as the desktop app — call it directly
const OLLAMA_BASE = 'http://localhost:11434';

async function fetchOllamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return { running: false, models: [] };
    const data = await res.json();
    const models: OllamaModel[] = (data.models ?? []).map((m: { name: string; size: number; details?: { parameter_size?: string } }) => ({
      name: m.name,
      sizeBytes: m.size ?? 0,
      parameterSize: m.details?.parameter_size ?? '',
    }));
    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

async function loadOllamaModel(model: string): Promise<void> {
  await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, keep_alive: '5m' }),
  });
}

async function unloadOllamaModel(model: string): Promise<void> {
  await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, keep_alive: '0' }),
  });
}

/** AI task keys used for per-task provider configuration. */
const AI_TASKS = [
  { key: 'summarization' as const, label: 'Resumo' },
  { key: 'extraction' as const, label: 'Extração' },
  { key: 'chat' as const, label: 'Chat' },
];

const MODEL_OPTIONS = [
  { value: 'large-v3', label: 'Large V3', description: '4GB, melhor precisão, ~15x realtime' },
  { value: 'medium', label: 'Medium', description: '2GB, ótima precisão, ~30x realtime' },
  { value: 'small', label: 'Small', description: '1GB, boa precisão, ~45x realtime' },
  { value: 'base', label: 'Base', description: '142MB, aceitável, ~100x realtime' },
  { value: 'tiny', label: 'Tiny', description: '75MB, básica, ~150x realtime' }
];

export function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [showOllamaSetup, setShowOllamaSetup] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.electronAPI.settings.get()
  });

  const { data: whisperStatus } = useQuery({
    queryKey: ['whisper-status'],
    queryFn: () => window.electronAPI.whisper.getStatus()
  });

  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: keyof Settings; value: unknown }) =>
      window.electronAPI.settings.set(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    }
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // ─── AI Settings state (fetched directly via REST, not IPC) ─────────────
  const [aiConfig, setAiConfig] = useState<AiSettingsConfig>({
    summarization: { provider: 'openai', model: 'gpt-4o' },
    extraction: { provider: 'openai', model: 'gpt-4o' },
    chat: { provider: 'openai', model: 'gpt-4o' },
    openaiEnabled: true,
  });
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ running: false, models: [] });
  const [aiLoading, setAiLoading] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSaveSuccess, setAiSaveSuccess] = useState(false);
  const [ollamaActionLoading, setOllamaActionLoading] = useState<string | null>(null);

  /** Load AI settings + Ollama status. Falls back to local electron-store if backend is offline. */
  const refreshAiData = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const ollamaRes = await fetchOllamaStatus();
      setOllamaStatus(ollamaRes);

      // Try backend first, fall back to local electron-store
      try {
        const aiRes = await fetchAiSettings();
        setAiConfig(aiRes.config);
      } catch {
        // Backend offline — load from local electron-store
        const localSettings = await window.electronAPI.settings.get();
        const local = (localSettings as any).aiConfig;
        if (local) {
          setAiConfig(prev => ({
            ...prev,
            summarization: local.summarization ?? prev.summarization,
            extraction: local.extraction ?? prev.extraction,
            chat: local.chat ?? prev.chat,
          }));
        }
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erro ao carregar configurações de IA');
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAiData();
  }, [refreshAiData]);

  /** Save AI config to backend + persist locally in electron-store. */
  const handleSaveAiSettings = async () => {
    setAiSaving(true);
    setAiError(null);
    setAiSaveSuccess(false);
    try {
      // Always persist locally (works offline)
      await window.electronAPI.settings.set('aiConfig', {
        summarization: aiConfig.summarization,
        extraction: aiConfig.extraction,
        chat: aiConfig.chat,
      });

      // Try to also save to backend (best-effort)
      try {
        const res = await saveAiSettings(aiConfig);
        setAiConfig(res.config);
      } catch {
        // Backend offline — local save is enough
      }

      setAiSaveSuccess(true);
      setTimeout(() => setAiSaveSuccess(false), 3000);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erro ao salvar configurações de IA');
    } finally {
      setAiSaving(false);
    }
  };

  /** Update a single AI task's provider or model. */
  const handleAiTaskChange = (
    task: 'summarization' | 'extraction' | 'chat',
    field: 'provider' | 'model',
    value: string,
  ) => {
    setAiConfig(prev => ({
      ...prev,
      [task]: { ...prev[task], [field]: value },
    }));
  };

  /** Load or unload an Ollama model. */
  const handleOllamaModelAction = async (modelName: string, action: 'load' | 'unload') => {
    setOllamaActionLoading(modelName);
    try {
      if (action === 'load') {
        await loadOllamaModel(modelName);
      } else {
        await unloadOllamaModel(modelName);
      }
      // Refresh status after action
      const updated = await fetchOllamaStatus();
      setOllamaStatus(updated);
    } catch {
      // Silently handle — the status will reflect reality on next poll
    } finally {
      setOllamaActionLoading(null);
    }
  };

  const handleChange = (key: keyof Settings, value: unknown) => {
    setLocalSettings(prev => prev ? { ...prev, [key]: value } : null);
    updateSettingMutation.mutate({ key, value });
  };

  if (isLoading || !localSettings) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-dd-border border-t-indigo-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-100">Configurações</h2>
        <p className="mt-1 text-sm text-slate-400">
          Configurações do aplicativo e do processamento local
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <section className="rounded-xl border border-dd-border bg-dd-surface p-5">
          <h3 className="text-lg font-semibold text-slate-100">Aparência</h3>
          <p className="mt-1 text-sm text-slate-400">Tema visual do aplicativo</p>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                theme === 'dark'
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-dd-border bg-dd-elevated hover:border-dd-border'
              }`}
            >
              <span className={`font-medium ${theme === 'dark' ? 'text-indigo-400' : 'text-slate-200'}`}>Escuro</span>
              <p className="mt-0.5 text-xs text-slate-400">Tema escuro padrão</p>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                theme === 'light'
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-dd-border bg-dd-elevated hover:border-dd-border'
              }`}
            >
              <span className={`font-medium ${theme === 'light' ? 'text-indigo-400' : 'text-slate-200'}`}>Claro</span>
              <p className="mt-0.5 text-xs text-slate-400">Tema claro</p>
            </button>
          </div>
        </section>

        {/* Server URL */}
        <section className="rounded-xl border border-dd-border bg-dd-surface p-5">
          <h3 className="text-lg font-semibold text-slate-100">Servidor</h3>
          <p className="mt-1 text-sm text-slate-400">URL do servidor DecisionDesk</p>
          
          <div className="mt-4">
            <input
              type="url"
              value={localSettings.apiUrl}
              onChange={(e) => handleChange('apiUrl', e.target.value)}
              className="w-full rounded-lg border border-dd-border bg-dd-elevated px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="http://localhost:8080"
            />
          </div>
        </section>

        {/* Whisper Model */}
        <section className="rounded-xl border border-dd-border bg-dd-surface p-5">
          <h3 className="text-lg font-semibold text-slate-100">Modelo Whisper</h3>
          <p className="mt-1 text-sm text-slate-400">
            Modelo padrão para transcrição local
          </p>

          <div className="mt-4 space-y-2">
            {MODEL_OPTIONS.map((model) => {
              const isAvailable = whisperStatus?.models.includes(model.value);
              const isSelected = localSettings.whisperModel === model.value;

              return (
                <button
                  key={model.value}
                  onClick={() => isAvailable && handleChange('whisperModel', model.value)}
                  disabled={!isAvailable}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : isAvailable
                      ? 'border-dd-border bg-dd-elevated hover:border-dd-border'
                      : 'border-dd-border bg-dd-surface/50 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isSelected ? 'text-indigo-400' : 'text-slate-200'}`}>
                          {model.label}
                        </span>
                        {!isAvailable && (
                          <span className="rounded bg-dd-border px-1.5 py-0.5 text-xs text-slate-400">
                            Não instalado
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 text-xs text-slate-400">{model.description}</span>
                    </div>
                    {isSelected && (
                      <svg className="h-5 w-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Processing Options */}
        <section className="rounded-xl border border-dd-border bg-dd-surface p-5">
          <h3 className="text-lg font-semibold text-slate-100">Opções de Processamento</h3>
          
          <div className="mt-4 space-y-4">
            {/* Diarization */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-200">Identificar Falantes</span>
                <p className="text-sm text-slate-400">
                  Usa pyannote-audio para detectar quem falou cada trecho
                </p>
              </div>
              <button
                onClick={() => handleChange('enableDiarization', !localSettings.enableDiarization)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  localSettings.enableDiarization ? 'bg-indigo-600' : 'bg-dd-border'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    localSettings.enableDiarization ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* HuggingFace token (needed once to download pyannote weights) */}
            {localSettings.enableDiarization && (
              <div className="space-y-1">
                <label className="font-medium text-slate-200" htmlFor="hf-token">
                  Token HuggingFace
                </label>
                <p className="text-sm text-slate-400">
                  Necessário <strong>uma vez</strong> para baixar o modelo pyannote (roda local depois).
                  {' '}Crie um token em{' '}
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline"
                  >
                    huggingface.co/settings/tokens
                  </a>
                  {' '}e aceite os termos em{' '}
                  <a
                    href="https://huggingface.co/pyannote/speaker-diarization-3.1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline"
                  >
                    pyannote/speaker-diarization-3.1
                  </a>.
                </p>
                <input
                  id="hf-token"
                  type="password"
                  autoComplete="off"
                  placeholder="hf_..."
                  defaultValue={localSettings.huggingfaceToken ?? ''}
                  onBlur={(e) => {
                    const val = e.currentTarget.value.trim();
                    if (val !== (localSettings.huggingfaceToken ?? '')) {
                      handleChange('huggingfaceToken', val || undefined);
                    }
                  }}
                  className="w-full rounded-lg border border-dd-border bg-dd-bg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {/* Auto Accept */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-200">Aceitar Automaticamente</span>
                <p className="text-sm text-slate-400">
                  Processar novos jobs automaticamente quando chegarem
                </p>
              </div>
              <button
                onClick={() => handleChange('autoAcceptJobs', !localSettings.autoAcceptJobs)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  localSettings.autoAcceptJobs ? 'bg-indigo-600' : 'bg-dd-border'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    localSettings.autoAcceptJobs ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-200">Notificações</span>
                <p className="text-sm text-slate-400">
                  Mostrar notificações quando novos jobs chegarem
                </p>
              </div>
              <button
                onClick={() => handleChange('notificationsEnabled', !localSettings.notificationsEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  localSettings.notificationsEnabled ? 'bg-indigo-600' : 'bg-dd-border'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    localSettings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* IA / Resumos */}
        <section className="rounded-xl border border-dd-border bg-dd-surface p-5">
          <h3 className="text-lg font-semibold text-slate-100">IA / Resumos</h3>
          <p className="mt-1 text-sm text-slate-400">
            Provedor de IA por tarefa e gerenciamento do Ollama local
          </p>

          {aiLoading ? (
            <div className="mt-4 flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-dd-border border-t-indigo-400" />
              <span className="text-sm text-slate-400">Carregando configurações de IA...</span>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {/* Prefer Local toggle */}
              <div className="flex items-center justify-between rounded-lg border border-dd-border bg-dd-elevated p-4">
                <div>
                  <span className="font-medium text-slate-200">Preferir processamento local</span>
                  <p className="text-sm text-slate-400">
                    Usar Ollama como provedor padrão para chat e resumos
                  </p>
                </div>
                <button
                  onClick={() => handleChange('preferLocal', !localSettings.preferLocal)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    localSettings.preferLocal ? 'bg-indigo-600' : 'bg-dd-border'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      localSettings.preferLocal ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Ollama Status */}
              {ollamaStatus.running ? (
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-300">Ollama rodando</span>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                  <button
                    onClick={() => setShowOllamaSetup(!showOllamaSetup)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-500/5 transition-colors"
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-sm text-amber-200/90 flex-1">Ollama não conectado</span>
                    <svg
                      className={`h-3.5 w-3.5 text-slate-500 transition-transform ${showOllamaSetup ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showOllamaSetup && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <svg className="h-3.5 w-3.5 text-amber-400/70 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="space-y-2 flex-1">
                          <p className="text-xs text-slate-400">Instalar e iniciar:</p>
                          <div className="rounded-md bg-dd-base border border-dd-border px-3 py-2 font-mono text-xs text-slate-300 space-y-1">
                            <p><span className="text-slate-500 select-none">$ </span>brew install ollama</p>
                            <p><span className="text-slate-500 select-none">$ </span>ollama serve</p>
                          </div>
                          <p className="text-xs text-slate-400">Baixar um modelo para resumos:</p>
                          <div className="rounded-md bg-dd-base border border-dd-border px-3 py-2 font-mono text-xs text-slate-300">
                            <p><span className="text-slate-500 select-none">$ </span>ollama pull qwen2.5:14b</p>
                          </div>
                        </div>
                      </div>
                      <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        ollama.com
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Error banner */}
              {aiError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                  {aiError}
                </div>
              )}

              {/* Per-task AI provider selectors */}
              {AI_TASKS.map(({ key, label }) => (
                <div key={key} className="rounded-lg border border-dd-border bg-dd-elevated p-4">
                  <span className="font-medium text-slate-200">{label}</span>

                  {/* Radio row */}
                  <div className="mt-3 flex gap-3">
                    <button
                      onClick={() => handleAiTaskChange(key, 'provider', 'ollama')}
                      className={`flex-1 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                        aiConfig[key].provider === 'ollama'
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-dd-border bg-dd-surface hover:border-dd-border'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-3.5 w-3.5 rounded-full border-2 ${
                          aiConfig[key].provider === 'ollama'
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-slate-500'
                        }`}>
                          {aiConfig[key].provider === 'ollama' && (
                            <div className="mx-auto mt-[3px] h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span className={aiConfig[key].provider === 'ollama' ? 'text-indigo-400' : 'text-slate-300'}>
                          Ollama (Local)
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => handleAiTaskChange(key, 'provider', 'openai')}
                      className={`flex-1 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                        aiConfig[key].provider === 'openai'
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-dd-border bg-dd-surface hover:border-dd-border'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-3.5 w-3.5 rounded-full border-2 ${
                          aiConfig[key].provider === 'openai'
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-slate-500'
                        }`}>
                          {aiConfig[key].provider === 'openai' && (
                            <div className="mx-auto mt-[3px] h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <span className={aiConfig[key].provider === 'openai' ? 'text-indigo-400' : 'text-slate-300'}>
                          OpenAI (Cloud)
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Model text input */}
                  <input
                    type="text"
                    value={aiConfig[key].model}
                    onChange={(e) => handleAiTaskChange(key, 'model', e.target.value)}
                    placeholder={aiConfig[key].provider === 'ollama' ? 'ex: llama3:8b' : 'ex: gpt-4o'}
                    className="mt-3 w-full rounded-lg border border-dd-border bg-dd-surface px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}

              {/* Installed Ollama Models */}
              <div>
                <span className="text-sm font-medium text-slate-300">Modelos Ollama Instalados</span>
                {ollamaStatus.models.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {ollamaStatus.models.map((m) => (
                      <div
                        key={m.name}
                        className="flex items-center justify-between rounded-lg border border-dd-border bg-dd-elevated px-4 py-2.5"
                      >
                        <div>
                          <span className="text-sm font-medium text-slate-200">{m.name}</span>
                          <span className="ml-2 text-xs text-slate-400">
                            {m.parameterSize} &middot; {(m.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOllamaModelAction(m.name, 'load')}
                            disabled={ollamaActionLoading === m.name}
                            className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                          >
                            {ollamaActionLoading === m.name ? '...' : 'Carregar'}
                          </button>
                          <button
                            onClick={() => handleOllamaModelAction(m.name, 'unload')}
                            disabled={ollamaActionLoading === m.name}
                            className="rounded-md border border-dd-border bg-dd-surface px-3 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-dd-border disabled:opacity-50"
                          >
                            {ollamaActionLoading === m.name ? '...' : 'Descarregar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    {ollamaStatus.running
                      ? 'Nenhum modelo encontrado no Ollama.'
                      : 'Ollama offline — inicie o servidor para ver modelos.'}
                  </p>
                )}
              </div>

              {/* Save button */}
              <button
                onClick={handleSaveAiSettings}
                disabled={aiSaving}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {aiSaving ? 'Salvando...' : 'Salvar Configuração IA'}
              </button>

              {/* Success feedback */}
              {aiSaveSuccess && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
                  Configuração de IA salva com sucesso!
                </div>
              )}
            </div>
          )}
        </section>

        {/* Whisper Status */}
        <section className="rounded-xl border border-dd-border bg-dd-surface p-5">
          <h3 className="text-lg font-semibold text-slate-100">Status do Whisper</h3>
          
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${whisperStatus?.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-sm text-slate-300">
                {whisperStatus?.available ? 'Whisper.cpp disponível' : 'Whisper.cpp não encontrado'}
              </span>
            </div>

            {whisperStatus?.models?.length ? (
              <div>
                <span className="text-sm text-slate-400">Modelos instalados:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {whisperStatus.models.map((model) => (
                    <span
                      key={model}
                      className="rounded-md bg-dd-elevated px-2.5 py-1 text-xs text-slate-300"
                    >
                      {model}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Nenhum modelo instalado. Faça download dos modelos GGML em ~/.whisper/models/
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
