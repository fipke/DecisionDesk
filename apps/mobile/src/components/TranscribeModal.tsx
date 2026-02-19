import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { TranscriptionProvider, WhisperModel } from '../types';

export interface TranscribeModalOptions {
  provider: TranscriptionProvider;
  model: WhisperModel;
  enableDiarization: boolean;
}

interface TranscribeModalProps {
  visible: boolean;
  defaultProvider: TranscriptionProvider;
  defaultModel: WhisperModel;
  defaultDiarization: boolean;
  onConfirm: (options: TranscribeModalOptions) => void;
  onCancel: () => void;
}

const PROVIDER_OPTIONS: { value: TranscriptionProvider; label: string; description: string }[] = [
  {
    value: 'desktop_local',
    label: 'Mac Local (whisper.cpp)',
    description: 'Gratuito, privado. Áudio vai para fila do Mac.'
  },
  {
    value: 'server_local',
    label: 'Servidor Local (whisper.cpp)',
    description: 'Gratuito, rápido. VPS processa imediatamente.'
  },
  {
    value: 'remote_openai',
    label: 'OpenAI Cloud',
    description: 'Pago (~$0.006/min). Transcrição imediata.'
  }
];

const MODEL_OPTIONS: { value: WhisperModel; label: string }[] = [
  { value: 'large-v3', label: 'Large V3 (melhor)' },
  { value: 'medium', label: 'Medium' },
  { value: 'small', label: 'Small' },
  { value: 'base', label: 'Base' },
  { value: 'tiny', label: 'Tiny (mais rápido)' }
];

export function TranscribeModal({
  visible,
  defaultProvider,
  defaultModel,
  defaultDiarization,
  onConfirm,
  onCancel
}: TranscribeModalProps) {
  const [provider, setProvider] = useState<TranscriptionProvider>(defaultProvider);
  const [model, setModel] = useState<WhisperModel>(defaultModel);
  const [diarization, setDiarization] = useState(defaultDiarization);

  const handleConfirm = () => {
    onConfirm({ provider, model, enableDiarization: diarization });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[85%] rounded-t-3xl bg-dd-surface px-5 py-6">
          <Text className="text-center text-xl font-bold text-slate-100">
            Opções de Transcrição
          </Text>

          <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
            {/* Provider Selection */}
            <Text className="mb-2 text-sm font-semibold text-slate-300">Provedor</Text>
            {PROVIDER_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setProvider(option.value)}
                className={`mb-2 rounded-xl border px-4 py-3 ${
                  provider === option.value
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-dd-border bg-dd-elevated'
                }`}
              >
                <View className="flex-row items-center">
                  <View
                    className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                      provider === option.value ? 'border-indigo-500' : 'border-slate-500'
                    }`}
                  >
                    {provider === option.value && (
                      <View className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-base font-medium ${
                        provider === option.value ? 'text-indigo-400' : 'text-slate-200'
                      }`}
                    >
                      {option.label}
                    </Text>
                    <Text className="text-xs text-slate-400">{option.description}</Text>
                  </View>
                </View>
              </Pressable>
            ))}

            {/* Model Selection (only for local providers) */}
            {(provider === 'desktop_local' || provider === 'server_local') && (
              <>
                <Text className="mb-2 mt-4 text-sm font-semibold text-slate-300">
                  Modelo Whisper
                </Text>
                <View className="flex-row flex-wrap">
                  {MODEL_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setModel(option.value)}
                      className={`mb-2 mr-2 rounded-lg border px-3 py-2 ${
                        model === option.value
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-dd-border bg-dd-elevated'
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          model === option.value ? 'text-indigo-400' : 'text-slate-300'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Diarization Toggle */}
                <View className="mt-4 flex-row items-center justify-between rounded-xl border border-dd-border bg-dd-elevated px-4 py-3">
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-medium text-slate-200">
                      Identificar Falantes
                    </Text>
                    <Text className="text-xs text-slate-400">
                      Detectar quem falou cada trecho (pyannote)
                    </Text>
                  </View>
                  <Switch
                    value={diarization}
                    onValueChange={setDiarization}
                    thumbColor={diarization ? '#818cf8' : '#1e293b'}
                    trackColor={{ false: '#1e293b', true: '#312e81' }}
                  />
                </View>
              </>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View className="mt-6 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 rounded-xl border border-dd-border bg-dd-elevated py-4"
            >
              <Text className="text-center text-base font-semibold text-slate-300">Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              className="flex-1 rounded-xl bg-indigo-600 py-4"
            >
              <Text className="text-center text-base font-semibold text-white">Transcrever</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
