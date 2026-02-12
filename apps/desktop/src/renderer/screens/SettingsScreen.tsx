import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Settings {
  apiUrl: string;
  whisperModel: string;
  enableDiarization: boolean;
  autoAcceptJobs: boolean;
  notificationsEnabled: boolean;
}

const MODEL_OPTIONS = [
  { value: 'large-v3', label: 'Large V3', description: '4GB, melhor precisão, ~15x realtime' },
  { value: 'medium', label: 'Medium', description: '2GB, ótima precisão, ~30x realtime' },
  { value: 'small', label: 'Small', description: '1GB, boa precisão, ~45x realtime' },
  { value: 'base', label: 'Base', description: '142MB, aceitável, ~100x realtime' },
  { value: 'tiny', label: 'Tiny', description: '75MB, básica, ~150x realtime' }
];

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);

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

  const handleChange = (key: keyof Settings, value: unknown) => {
    setLocalSettings(prev => prev ? { ...prev, [key]: value } : null);
    updateSettingMutation.mutate({ key, value });
  };

  if (isLoading || !localSettings) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
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
        {/* Server URL */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold text-slate-100">Servidor</h3>
          <p className="mt-1 text-sm text-slate-400">URL do servidor DecisionDesk</p>
          
          <div className="mt-4">
            <input
              type="url"
              value={localSettings.apiUrl}
              onChange={(e) => handleChange('apiUrl', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="http://localhost:8080"
            />
          </div>
        </section>

        {/* Whisper Model */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
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
                      ? 'border-emerald-500 bg-emerald-950/30'
                      : isAvailable
                      ? 'border-slate-700 bg-slate-800 hover:border-slate-600'
                      : 'border-slate-800 bg-slate-900/50 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {model.label}
                        </span>
                        {!isAvailable && (
                          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">
                            Não instalado
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 text-xs text-slate-400">{model.description}</span>
                    </div>
                    {isSelected && (
                      <svg className="h-5 w-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
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
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
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
                  localSettings.enableDiarization ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    localSettings.enableDiarization ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

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
                  localSettings.autoAcceptJobs ? 'bg-emerald-600' : 'bg-slate-700'
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
                  localSettings.notificationsEnabled ? 'bg-emerald-600' : 'bg-slate-700'
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

        {/* Whisper Status */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
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
                      className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-300"
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
