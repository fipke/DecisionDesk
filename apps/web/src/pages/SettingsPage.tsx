import { useState, useEffect } from 'react';
import { Server, Info, Sun, Moon, Cpu, Cloud, Loader2, Download, XCircle, Terminal, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../ThemeContext';
import {
  fetchAiSettings,
  updateAiSettings,
  fetchOllamaStatus,
  loadOllamaModel,
  unloadOllamaModel,
  type AiSettingsConfig,
  type AiTaskConfig,
} from '../services/api';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8087';

type TaskKey = 'summarization' | 'extraction' | 'chat';

const TASK_LABELS: Record<TaskKey, string> = {
  summarization: 'Resumo',
  extraction: 'Extração',
  chat: 'Chat',
};

const DEFAULT_MODELS: Record<TaskKey, string> = {
  summarization: 'qwen2.5:14b',
  extraction: 'qwen3:8b',
  chat: 'qwen2.5:14b',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Settings page with appearance, API URL, AI providers, and version info. */
export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // --- AI Settings state ---
  const [aiConfig, setAiConfig] = useState<AiSettingsConfig>({
    summarization: { provider: 'ollama', model: DEFAULT_MODELS.summarization },
    extraction: { provider: 'ollama', model: DEFAULT_MODELS.extraction },
    chat: { provider: 'ollama', model: DEFAULT_MODELS.chat },
    openaiEnabled: false,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showOllamaSetup, setShowOllamaSetup] = useState(false);

  // --- Queries ---
  const aiSettingsQuery = useQuery({
    queryKey: ['ai-settings'],
    queryFn: fetchAiSettings,
    retry: 1,
  });

  const ollamaQuery = useQuery({
    queryKey: ['ollama-status'],
    queryFn: fetchOllamaStatus,
    refetchInterval: 15_000,
  });

  // Sync remote config into local state when loaded
  useEffect(() => {
    if (aiSettingsQuery.data?.config) {
      setAiConfig(aiSettingsQuery.data.config);
    }
  }, [aiSettingsQuery.data]);

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: () => updateAiSettings(aiConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  const loadModelMutation = useMutation({
    mutationFn: (model: string) => loadOllamaModel(model),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ollama-status'] });
    },
  });

  const unloadModelMutation = useMutation({
    mutationFn: (model: string) => unloadOllamaModel(model),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ollama-status'] });
    },
  });

  // --- Helpers ---
  const ollamaRunning = ollamaQuery.data?.running ?? false;
  const ollamaModels = ollamaQuery.data?.models ?? [];

  function updateTask(task: TaskKey, patch: Partial<AiTaskConfig>) {
    setAiConfig((prev) => ({
      ...prev,
      [task]: { ...prev[task], ...patch },
    }));
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-dd-base">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-dd-border">
        <h1 className="text-slate-100 text-xl font-semibold">Configurações</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg space-y-4">
          {/* Appearance card */}
          <div className="bg-dd-surface border border-dd-border rounded-xl p-5">
            <h2 className="text-slate-100 text-sm font-medium mb-3">Aparência</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center gap-2 rounded-lg border px-4 py-3 text-left transition-colors ${
                  theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-dd-border bg-dd-elevated hover:border-dd-border'
                }`}
              >
                <Moon size={16} className={theme === 'dark' ? 'text-indigo-400' : 'text-slate-400'} />
                <div>
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-indigo-400' : 'text-slate-200'}`}>Escuro</span>
                  <p className="text-xs text-slate-400 mt-0.5">Tema escuro padrão</p>
                </div>
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center gap-2 rounded-lg border px-4 py-3 text-left transition-colors ${
                  theme === 'light'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-dd-border bg-dd-elevated hover:border-dd-border'
                }`}
              >
                <Sun size={16} className={theme === 'light' ? 'text-indigo-400' : 'text-slate-400'} />
                <div>
                  <span className={`text-sm font-medium ${theme === 'light' ? 'text-indigo-400' : 'text-slate-200'}`}>Claro</span>
                  <p className="text-xs text-slate-400 mt-0.5">Tema claro</p>
                </div>
              </button>
            </div>
          </div>

          {/* API URL card */}
          <div className="bg-dd-surface border border-dd-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Server size={15} className="text-indigo-400 shrink-0" />
              <h2 className="text-slate-100 text-sm font-medium">Servidor da API</h2>
            </div>

            <div className="bg-dd-base border border-dd-border rounded-lg px-4 py-3">
              <p className="text-indigo-400 text-sm font-mono break-all">{API_URL}</p>
            </div>

            <div className="mt-3 flex items-start gap-2">
              <Info size={13} className="text-slate-500 mt-0.5 shrink-0" />
              <p className="text-slate-500 text-xs leading-relaxed">
                Para alterar o servidor, edite a variável{' '}
                <code className="text-slate-400 bg-dd-elevated px-1 py-0.5 rounded text-xs">
                  VITE_API_URL
                </code>{' '}
                no arquivo{' '}
                <code className="text-slate-400 bg-dd-elevated px-1 py-0.5 rounded text-xs">
                  .env
                </code>{' '}
                e reinicie o servidor de desenvolvimento.
              </p>
            </div>
          </div>

          {/* ─── AI Provider Settings ────────────────────────────────────── */}
          <div className="bg-dd-surface border border-dd-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={15} className="text-indigo-400 shrink-0" />
              <h2 className="text-slate-100 text-sm font-medium">Provedor de IA</h2>
            </div>

            {/* Ollama status */}
            {ollamaRunning ? (
              <div className="flex items-center gap-2 mb-5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-sm text-slate-300">Ollama disponível</span>
                {ollamaQuery.isLoading && (
                  <Loader2 size={14} className="text-slate-500 animate-spin" />
                )}
              </div>
            ) : (
              <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOllamaSetup(!showOllamaSetup)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-500/5 transition-colors"
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-sm text-amber-200/90 flex-1">Ollama não conectado</span>
                  {ollamaQuery.isLoading ? (
                    <Loader2 size={14} className="text-slate-500 animate-spin shrink-0" />
                  ) : showOllamaSetup ? (
                    <ChevronUp size={14} className="text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-slate-500 shrink-0" />
                  )}
                </button>
                {showOllamaSetup && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Terminal size={13} className="text-amber-400/70 mt-0.5 shrink-0" />
                      <div className="space-y-2 flex-1">
                        <p className="text-xs text-slate-400">Instalar e iniciar:</p>
                        <div className="bg-dd-base rounded-md px-3 py-2 font-mono text-xs text-slate-300 space-y-1">
                          <p><span className="text-slate-500 select-none">$ </span>brew install ollama</p>
                          <p><span className="text-slate-500 select-none">$ </span>ollama serve</p>
                        </div>
                        <p className="text-xs text-slate-400">Baixar um modelo para resumos:</p>
                        <div className="bg-dd-base rounded-md px-3 py-2 font-mono text-xs text-slate-300">
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
                      <ExternalLink size={11} />
                      ollama.com
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Per-task provider configuration */}
            <div className="space-y-5">
              {(Object.keys(TASK_LABELS) as TaskKey[]).map((task) => (
                <div key={task}>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">
                    {TASK_LABELS[task]}
                  </label>

                  {/* Provider radio buttons */}
                  <div className="flex gap-3 mb-2">
                    <button
                      type="button"
                      onClick={() => updateTask(task, { provider: 'ollama' })}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        aiConfig[task].provider === 'ollama'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border-dd-border bg-dd-elevated text-slate-400 hover:border-dd-border'
                      }`}
                    >
                      <Cpu size={14} />
                      Ollama (Local)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTask(task, { provider: 'openai' })}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        aiConfig[task].provider === 'openai'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border-dd-border bg-dd-elevated text-slate-400 hover:border-dd-border'
                      }`}
                    >
                      <Cloud size={14} />
                      OpenAI (Cloud)
                    </button>
                  </div>

                  {/* Model input */}
                  <input
                    type="text"
                    value={aiConfig[task].model}
                    onChange={(e) => updateTask(task, { model: e.target.value })}
                    placeholder={DEFAULT_MODELS[task]}
                    className="w-full bg-dd-base border border-dd-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              ))}
            </div>

            {/* Installed Ollama models list */}
            {ollamaModels.length > 0 && (
              <div className="mt-5 pt-5 border-t border-dd-border">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Modelos Ollama instalados
                </h3>
                <div className="space-y-2">
                  {ollamaModels.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between bg-dd-base border border-dd-border rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 font-mono truncate">{m.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatBytes(m.sizeBytes)}
                          {m.parameterSize ? ` / ${m.parameterSize}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={() => loadModelMutation.mutate(m.name)}
                          disabled={loadModelMutation.isPending}
                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                        >
                          {loadModelMutation.isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )}
                          Carregar
                        </button>
                        <button
                          type="button"
                          onClick={() => unloadModelMutation.mutate(m.name)}
                          disabled={unloadModelMutation.isPending}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                        >
                          {unloadModelMutation.isPending ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <XCircle size={12} />
                          )}
                          Descarregar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save button */}
            <div className="mt-5 pt-5 border-t border-dd-border flex items-center gap-3">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
              >
                {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Salvar configurações
              </button>
              {saveSuccess && (
                <span className="text-sm text-emerald-400">Salvo com sucesso!</span>
              )}
              {saveMutation.isError && (
                <span className="text-sm text-red-400">Erro ao salvar.</span>
              )}
            </div>
          </div>

          {/* Version card */}
          <div className="bg-dd-surface border border-dd-border rounded-xl p-5">
            <h2 className="text-slate-100 text-sm font-medium mb-3">Sobre</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Versão</span>
                <span className="text-slate-300">0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plataforma</span>
                <span className="text-slate-300">Web</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
