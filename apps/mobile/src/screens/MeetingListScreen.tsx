import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Cog6ToothIcon, PlusIcon } from 'react-native-heroicons/outline';

import { MeetingListItem } from '../components/MeetingListItem';
import { PrimaryButton } from '../components/PrimaryButton';
import * as Network from 'expo-network';
import { NetworkStateType } from 'expo-network';

import { useSyncQueue } from '../hooks/useSyncQueue';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMeetings } from '../state/MeetingContext';
import { useSettings } from '../state/SettingsContext';

export type MeetingListScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function MeetingListScreen({ navigation }: MeetingListScreenProps) {
  const { meetings, loading, syncPendingOperations } = useMeetings();
  const { allowCellular } = useSettings();

  useSyncQueue();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}> 
          <Cog6ToothIcon size={20} color="#94a3b8" />
        </TouchableOpacity>
      )
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      Network.getNetworkStateAsync().then((state) => {
        if (!state.isConnected) {
          return;
        }
        if (state.type === NetworkStateType.CELLULAR && !allowCellular) {
          return;
        }
        syncPendingOperations();
      });
    }, [allowCellular, syncPendingOperations])
  );

  const handleCreateRecording = useCallback(() => {
    navigation.navigate('Record');
  }, [navigation]);

  return (
    <View className="flex-1 bg-slate-950 px-4 py-6">
      <PrimaryButton
        title="Nova gravação"
        onPress={handleCreateRecording}
        icon={<PlusIcon size={18} color="#0f172a" />}
      />
      {loading ? (
        <View className="mt-10 items-center justify-center">
          <ActivityIndicator size="large" color="#34d399" />
          <Text className="mt-3 text-sm text-slate-400">Carregando reuniões…</Text>
        </View>
      ) : meetings.length === 0 ? (
        <View className="mt-12 items-center">
          <Text className="text-base font-medium text-slate-200">Nenhuma reunião ainda</Text>
          <Text className="mt-2 text-center text-sm text-slate-400">
            Toque em “Nova gravação” para capturar a próxima conversa.
          </Text>
        </View>
      ) : (
        <FlatList
          className="mt-6"
          data={meetings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MeetingListItem
              meeting={item}
              onPress={() => navigation.navigate('MeetingDetail', { id: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}
