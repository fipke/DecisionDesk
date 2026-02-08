import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { StatusBadge } from '../components/StatusBadge';
import { useNetworkGuard } from '../hooks/useNetworkGuard';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMeetings } from '../state/MeetingContext';
import { formatCurrency } from '../utils/format';

export type MeetingDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'MeetingDetail'>;

export function MeetingDetailScreen({ route }: MeetingDetailScreenProps) {
  const { meetings, refreshMeeting, transcribeMeeting } = useMeetings();
  const { ensureAllowedConnection } = useNetworkGuard();
  const [loading, setLoading] = useState(false);
  const meeting = useMemo(() => meetings.find((item) => item.id === route.params.id), [meetings, route.params.id]);

  useFocusEffect(
    useCallback(() => {
      if (meeting?.remoteId) {
        refreshMeeting(meeting.id);
      }
    }, [meeting?.remoteId, meeting?.id, refreshMeeting])
  );

  if (!meeting) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950 px-6">
        <Text className="text-base text-slate-300">Reunião não encontrada.</Text>
      </View>
    );
  }

  const canTranscribe = Boolean(meeting.remoteId) && meeting.status !== 'PROCESSING';

  const handleTranscribe = async () => {
    if (!meeting.remoteId) {
      Alert.alert('Aguardando envio', 'Sincronize a gravação antes de solicitar a transcrição.');
      return;
    }
    try {
      await ensureAllowedConnection();
    } catch (error) {
      return;
    }
    try {
      setLoading(true);
      await transcribeMeeting(meeting.id);
      Alert.alert('Pedido enviado', 'A transcrição foi iniciada. Atualize para acompanhar o status.');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível solicitar a transcrição agora.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-950 px-5 py-6" contentInsetAdjustmentBehavior="automatic">
      <View className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-slate-300">Status atual</Text>
          <StatusBadge status={meeting.status} />
        </View>
        <View className="mt-4">
          <Text className="text-xs uppercase tracking-wide text-slate-500">Custo estimado (BRL)</Text>
          <Text className="mt-1 text-lg font-semibold text-emerald-400">
            {formatCurrency(meeting.costBrl ?? null, 'BRL')}
          </Text>
        </View>
        <View className="mt-3">
          <Text className="text-xs uppercase tracking-wide text-slate-500">Custo estimado (USD)</Text>
          <Text className="mt-1 text-base font-medium text-slate-100">
            {formatCurrency(meeting.costUsd ?? null, 'USD')}
          </Text>
        </View>
      </View>

      <PrimaryButton
        title="Transcrever agora"
        onPress={handleTranscribe}
        disabled={!canTranscribe || loading}
      />

      <View className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
        <Text className="text-sm font-semibold text-slate-200">Transcrição</Text>
        {meeting.transcriptText ? (
          <Text className="mt-3 leading-relaxed text-slate-300">{meeting.transcriptText}</Text>
        ) : (
          <Text className="mt-3 text-sm text-slate-500">
            A transcrição será exibida aqui após o processamento.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
