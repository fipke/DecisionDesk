import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { RootStackParamList } from '../navigation/AppNavigator';
import { useSettings } from '../state/SettingsContext';
import { TranscriptionProvider, WhisperModel } from '../types';

export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const PROVIDER_OPTIONS: { value: TranscriptionProvider; label: string; description: string }[] = [
  {
    value: 'desktop_local',
    label: 'Mac Local (whisper.cpp)',
    description: 'Gratuito, privado. Requer Mac Desktop conectado.'
  },
  {
    value: 'server_local',
    label: 'Servidor Local (whisper.cpp)',
    description: 'Gratuito, rápido. VPS processa com whisper.cpp.'
  },
  {
    value: 'remote_openai',
    label: 'OpenAI Cloud',
    description: 'Pago (~$0.006/min). Funciona em qualquer lugar.'
  }
];

const MODEL_OPTIONS: { value: WhisperModel; label: string; description: string }[] = [
  { value: 'large-v3', label: 'Large V3', description: '4GB, ~15x realtime, melhor precisão' },
  { value: 'medium', label: 'Medium', description: '2GB, ~30x realtime, ótima precisão' },
  { value: 'small', label: 'Small', description: '1GB, ~45x realtime, boa precisão' },
  { value: 'base', label: 'Base', description: '142MB, ~100x realtime, precisão aceitável' },
  { value: 'tiny', label: 'Tiny', description: '75MB, ~150x realtime, precisão básica' }
];

function RadioOption<T extends string>({
  value,
  selected,
  label,
  description,
  onSelect
}: {
  value: T;
  selected: boolean;
  label: string;
  description: string;
  onSelect: (value: T) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      className={`mt-2 rounded-xl border px-4 py-3 ${
        selected ? 'border-emerald-500 bg-emerald-950/30' : 'border-slate-700 bg-slate-800/50'
      }`}
    >
      <View className="flex-row items-center">
        <View
          className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
            selected ? 'border-emerald-500' : 'border-slate-500'
          }`}
        >
          {selected && <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />}
        </View>
        <View className="flex-1">
          <Text className={`text-base font-medium ${selected ? 'text-emerald-400' : 'text-slate-200'}`}>
            {label}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-400">{description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function SettingsScreen() {
  const {
    allowCellular,
    setAllowCellular,
    transcription,
    setTranscriptionProvider,
    setWhisperModel,
    setEnableDiarization
  } = useSettings();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCellularToggle = async (value: boolean) => {
    setIsUpdating(true);
    await setAllowCellular(value);
    setIsUpdating(false);
  };

  const handleDiarizationToggle = async (value: boolean) => {
    await setEnableDiarization(value);
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-6 py-6" contentInsetAdjustmentBehavior="automatic">
      {/* Transcription Provider Section */}
      <View className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-5">
        <Text className="text-lg font-semibold text-slate-100">Provedor de Transcrição</Text>
        <Text className="mt-1 text-sm text-slate-400">
          Escolha onde o áudio será processado por padrão.
        </Text>
        {PROVIDER_OPTIONS.map((option) => (
          <RadioOption
            key={option.value}
            value={option.value}
            selected={transcription.defaultProvider === option.value}
            label={option.label}
            description={option.description}
            onSelect={setTranscriptionProvider}
          />
        ))}
      </View>

      {/* Whisper Model Section (only for local providers) */}
      {(transcription.defaultProvider === 'desktop_local' || transcription.defaultProvider === 'server_local') && (
        <View className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-5">
          <Text className="text-lg font-semibold text-slate-100">Modelo Whisper</Text>
          <Text className="mt-1 text-sm text-slate-400">
            Modelos maiores são mais precisos, mas mais lentos.
          </Text>
          {MODEL_OPTIONS.map((option) => (
            <RadioOption
              key={option.value}
              value={option.value}
              selected={transcription.defaultModel === option.value}
              label={option.label}
              description={option.description}
              onSelect={setWhisperModel}
            />
          ))}
        </View>
      )}

      {/* Speaker Diarization (only for local providers) */}
      {(transcription.defaultProvider === 'desktop_local' || transcription.defaultProvider === 'server_local') && (
        <View className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-5">
          <View className="flex-row items-center justify-between">
            <View className="mr-4 flex-1">
              <Text className="text-base font-semibold text-slate-100">Identificar Falantes</Text>
              <Text className="mt-2 text-sm text-slate-400">
                Usa pyannote-audio para detectar quem falou cada trecho.
              </Text>
            </View>
            <Switch
              value={transcription.enableDiarization}
              onValueChange={handleDiarizationToggle}
              thumbColor={transcription.enableDiarization ? '#34d399' : '#1e293b'}
              trackColor={{ false: '#1e293b', true: '#14532d' }}
            />
          </View>
        </View>
      )}

      {/* Network Section */}
      <View className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-5">
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="text-base font-semibold text-slate-100">Permitir dados celulares</Text>
            <Text className="mt-2 text-sm text-slate-400">
              Quando desativado, as gravações só serão enviadas e transcritas no Wi‑Fi.
            </Text>
          </View>
          <Switch
            value={allowCellular}
            onValueChange={handleCellularToggle}
            disabled={isUpdating}
            thumbColor={allowCellular ? '#34d399' : '#1e293b'}
            trackColor={{ false: '#1e293b', true: '#14532d' }}
          />
        </View>
      </View>

      {/* Info Banner for Local */}
      {transcription.defaultProvider === 'desktop_local' && (
        <View className="mt-6 rounded-xl border border-emerald-900 bg-emerald-950/30 px-4 py-3">
          <Text className="text-sm font-medium text-emerald-400">Modo Local Ativado</Text>
          <Text className="mt-1 text-xs text-emerald-300/70">
            O áudio será enviado para a fila do Mac Desktop. Abra o app desktop para processar as transcrições localmente com whisper.cpp.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
