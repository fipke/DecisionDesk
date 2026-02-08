import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { NetworkStateType } from 'expo-network';

import { PrimaryButton } from '../components/PrimaryButton';
import { useNetworkGuard } from '../hooks/useNetworkGuard';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMeetings } from '../state/MeetingContext';
import { useSettings } from '../state/SettingsContext';

export type RecordScreenProps = NativeStackScreenProps<RootStackParamList, 'Record'>;

export function RecordScreen({ navigation }: RecordScreenProps) {
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
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

  const formattedDuration = useMemo(() => {
    const totalSeconds = Math.floor(durationMillis / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [durationMillis]);

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
    <View className="flex-1 items-center justify-center bg-slate-950 px-6">
      <Text className="text-lg font-semibold text-slate-100">Gravação em AAC 48 kHz</Text>
      <Text className="mt-2 text-center text-sm text-slate-400">
        Toque no botão para iniciar ou finalizar a captura. A transcrição é feita manualmente após o envio.
      </Text>
      <View className="mt-10 h-40 w-40 items-center justify-center rounded-full border-4 border-emerald-500">
        <Text className="text-4xl font-bold text-emerald-400">{formattedDuration}</Text>
      </View>
      <PrimaryButton
        title={recording ? 'Parar e salvar' : 'Gravar agora'}
        onPress={handlePrimaryAction}
        disabled={isPreparing}
        variant={recording ? 'danger' : 'primary'}
      />
      <Text className="mt-6 text-center text-xs text-slate-500">
        Os arquivos são armazenados localmente e enviados assim que houver conexão liberada.
      </Text>
    </View>
  );
}
