import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { NetworkStateType } from 'expo-network';

import { InMeetingNotesPad } from '../components/InMeetingNotesPad';
import { WaveformView } from '../components/WaveformView';
import { useNetworkGuard } from '../hooks/useNetworkGuard';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMeetings } from '../state/MeetingContext';
import { useSettings } from '../state/SettingsContext';

export type RecordScreenProps = NativeStackScreenProps<RootStackParamList, 'Record'>;

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function RecordScreen({ navigation }: RecordScreenProps) {
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [notesVisible, setNotesVisible] = useState(false);
  const [liveNotes, setLiveNotes] = useState('');
  const { recordAndQueue, syncPendingOperations } = useMeetings();
  const { ensureAllowedConnection } = useNetworkGuard();
  const { allowCellular } = useSettings();

  useEffect(() => {
    let subscription: Audio.RecordingStatusUpdateListener | undefined;
    if (recording) {
      subscription = (status) => {
        if (status.isRecording) {
          setDurationMillis(status.durationMillis ?? 0);
        }
      };
      recording.setOnRecordingStatusUpdate(subscription);
    }
    return () => {
      recording?.setOnRecordingStatusUpdate(undefined);
    };
  }, [recording]);

  const startRecording = useCallback(async () => {
    if (recording) {
      return;
    }
    setIsPreparing(true);
    try {
      if (!permissionResponse || permissionResponse.status !== 'granted') {
        const { status } = await requestPermission();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'Autorize o uso do microfone para gravar suas reuniões.');
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      const recordingObject = new Audio.Recording();
      await recordingObject.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 48000,
          numberOfChannels: 1,
          bitRate: 96000
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          sampleRate: 48000,
          numberOfChannels: 1,
          bitRate: 96000
        }
      });
      await recordingObject.startAsync();
      setRecording(recordingObject);
      setDurationMillis(0);
    } catch (error) {
      Alert.alert('Erro ao iniciar', 'Não foi possível iniciar a gravação.');
    } finally {
      setIsPreparing(false);
    }
  }, [permissionResponse, recording, requestPermission]);

  const stopRecording = useCallback(async () => {
    if (!recording) {
      return;
    }
    setIsPreparing(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      if (!uri) {
        throw new Error('Gravação indisponível');
      }

      const meetingId = await recordAndQueue(uri);
      try {
        await ensureAllowedConnection();
        await syncPendingOperations();
      } catch (error) {
        // Mantém na fila para sincronização futura
      }

      Alert.alert('Gravação salva', 'Sua reunião foi armazenada e será sincronizada assim que possível.');
      navigation.replace('MeetingDetail', { id: meetingId });
    } catch (error) {
      Alert.alert('Erro na gravação', 'Não foi possível salvar a reunião. Tente novamente.');
    } finally {
      setRecording(null);
      setIsPreparing(false);
      setDurationMillis(0);
    }
  }, [ensureAllowedConnection, navigation, recordAndQueue, recording, syncPendingOperations]);

  const handlePrimaryAction = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  useEffect(() => {
    Network.getNetworkStateAsync().then((state) => {
      if (state.type === NetworkStateType.CELLULAR && !allowCellular) {
        Alert.alert(
          'Wi‑Fi preferencial',
          'Por padrão usamos Wi‑Fi. Ative dados celulares nas configurações caso queira sincronizar via 4G/5G.'
        );
      }
    });
  }, [allowCellular]);

  return (
    <View className="flex-1 bg-slate-950 px-6">
      {/* Notes FAB — only visible while recording */}
      {!!recording && (
        <Pressable
          className="absolute right-6 top-14 z-10 h-12 w-12 items-center justify-center rounded-full bg-slate-800"
          onPress={() => setNotesVisible(true)}
          accessibilityLabel="Abrir anotações"
        >
          <Text className="text-xl">📝</Text>
        </Pressable>
      )}

      {/* Main content — centered vertically */}
      <View className="flex-1 items-center justify-center">
        {/* Waveform */}
        <WaveformView height={80} isRecording={!!recording} />

        {/* Timer */}
        <Text className="mt-6 font-mono text-5xl font-bold text-slate-100">
          {formatDuration(durationMillis)}
        </Text>

        {/* Status text */}
        <View className="mt-3 flex-row items-center gap-2">
          {!!recording && (
            <View className="h-2 w-2 rounded-full bg-red-500" />
          )}
          <Text className="text-sm text-slate-400">
            {recording ? 'Gravando…' : 'Pronto para gravar'}
          </Text>
        </View>
      </View>

      {/* Bottom action button */}
      <View className="pb-12">
        <Pressable
          className={`w-full items-center rounded-2xl py-4 ${
            recording ? 'bg-red-600' : 'bg-emerald-600'
          } ${isPreparing ? 'opacity-50' : 'opacity-100'}`}
          onPress={handlePrimaryAction}
          disabled={isPreparing}
          accessibilityRole="button"
        >
          <Text className="text-base font-semibold text-white">
            {recording ? 'Parar e salvar' : 'Gravar agora'}
          </Text>
        </Pressable>
      </View>

      {/* In-meeting notes modal */}
      <InMeetingNotesPad
        visible={notesVisible}
        initialValue={liveNotes}
        onSave={(text) => setLiveNotes(text)}
        onClose={() => setNotesVisible(false)}
      />
    </View>
  );
}
