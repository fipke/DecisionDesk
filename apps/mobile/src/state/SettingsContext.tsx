import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { TranscriptionProvider, TranscriptionSettings, WhisperModel } from '../types';

interface SettingsState {
  allowCellular: boolean;
  setAllowCellular: (value: boolean) => Promise<void>;
  transcription: TranscriptionSettings;
  setTranscriptionProvider: (provider: TranscriptionProvider) => Promise<void>;
  setWhisperModel: (model: WhisperModel) => Promise<void>;
  setEnableDiarization: (enabled: boolean) => Promise<void>;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

const STORAGE_KEYS = {
  allowCellular: 'settings:allowCellular',
  transcriptionProvider: 'settings:transcriptionProvider',
  whisperModel: 'settings:whisperModel',
  enableDiarization: 'settings:enableDiarization'
};

// Default settings: local transcription with large-v3 model
const DEFAULT_TRANSCRIPTION: TranscriptionSettings = {
  defaultProvider: 'desktop_local',
  defaultModel: 'large-v3',
  enableDiarization: true
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [allowCellular, setAllowCellularState] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionSettings>(DEFAULT_TRANSCRIPTION);

  useEffect(() => {
    const loadSettings = async () => {
      const [cellular, provider, model, diarization] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.allowCellular),
        AsyncStorage.getItem(STORAGE_KEYS.transcriptionProvider),
        AsyncStorage.getItem(STORAGE_KEYS.whisperModel),
        AsyncStorage.getItem(STORAGE_KEYS.enableDiarization)
      ]);

      if (cellular !== null) {
        setAllowCellularState(cellular === 'true');
      }

      setTranscription({
        defaultProvider: (provider as TranscriptionProvider) || DEFAULT_TRANSCRIPTION.defaultProvider,
        defaultModel: (model as WhisperModel) || DEFAULT_TRANSCRIPTION.defaultModel,
        enableDiarization: diarization !== null ? diarization === 'true' : DEFAULT_TRANSCRIPTION.enableDiarization
      });
    };

    loadSettings();
  }, []);

  const setAllowCellular = async (value: boolean) => {
    setAllowCellularState(value);
    await AsyncStorage.setItem(STORAGE_KEYS.allowCellular, value ? 'true' : 'false');
  };

  const setTranscriptionProvider = async (provider: TranscriptionProvider) => {
    setTranscription((prev) => ({ ...prev, defaultProvider: provider }));
    await AsyncStorage.setItem(STORAGE_KEYS.transcriptionProvider, provider);
  };

  const setWhisperModel = async (model: WhisperModel) => {
    setTranscription((prev) => ({ ...prev, defaultModel: model }));
    await AsyncStorage.setItem(STORAGE_KEYS.whisperModel, model);
  };

  const setEnableDiarization = async (enabled: boolean) => {
    setTranscription((prev) => ({ ...prev, enableDiarization: enabled }));
    await AsyncStorage.setItem(STORAGE_KEYS.enableDiarization, enabled ? 'true' : 'false');
  };

  const value = useMemo(
    () => ({
      allowCellular,
      setAllowCellular,
      transcription,
      setTranscriptionProvider,
      setWhisperModel,
      setEnableDiarization
    }),
    [allowCellular, transcription]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('SettingsContext não encontrado');
  }
  return context;
}
