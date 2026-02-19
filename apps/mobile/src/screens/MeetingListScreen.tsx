import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from 'react-native';
import { Cog6ToothIcon, FolderIcon, PlusIcon } from 'react-native-heroicons/outline';
import * as Network from 'expo-network';
import { NetworkStateType } from 'expo-network';

import { EmptyState } from '../components/EmptyState';
import { MeetingCard } from '../components/MeetingCard';
import { SearchBar } from '../components/SearchBar';
import { useSyncQueue } from '../hooks/useSyncQueue';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useMeetings } from '../state/MeetingContext';
import { useSettings } from '../state/SettingsContext';
import type { Meeting } from '../types';

// Inline date grouping to avoid @decisiondesk/utils bundler issues
function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Hoje';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function groupByDate(items: Meeting[], getDate: (item: Meeting) => string): Record<string, Meeting[]> {
  return items.reduce<Record<string, Meeting[]>>((acc, item) => {
    const key = formatRelativeDate(getDate(item));
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/** Adapts global Meeting to the shape expected by MeetingCard (null → undefined for optional strings). */
function toCardMeeting(m: Meeting) {
  return {
    id: m.id,
    status: m.status,
    createdAt: m.createdAt,
    title: m.title ?? undefined,
    costBrl: m.costBrl ?? undefined,
    costUsd: m.costUsd ?? undefined,
    durationSec: m.durationSec ?? (m.minutes != null && m.minutes > 0 ? m.minutes * 60 : undefined),
    meetingTypeName: (m as any).meetingTypeName ?? undefined,
  };
}

export type MeetingListScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function MeetingListScreen({ navigation }: MeetingListScreenProps) {
  const { meetings, loading, syncError, syncPendingOperations } = useMeetings();
  const { allowCellular } = useSettings();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useSyncQueue();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.navigate('Folders')}
          className="mr-2 h-10 w-10 items-center justify-center"
        >
          <FolderIcon size={22} color="#94a3b8" />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          className="h-10 w-10 items-center justify-center"
        >
          <Cog6ToothIcon size={22} color="#94a3b8" />
        </Pressable>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      Network.getNetworkStateAsync().then((state) => {
        if (!state.isConnected) return;
        if (state.type === NetworkStateType.CELLULAR && !allowCellular) return;
        syncPendingOperations();
      });
    }, [allowCellular, syncPendingOperations])
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.transcriptText?.toLowerCase().includes(q)
    );
  }, [meetings, search]);

  const sections = useMemo(() => {
    const grouped = groupByDate(filtered, (m) => m.createdAt);
    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [filtered]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncPendingOperations();
    } finally {
      setRefreshing(false);
    }
  }, [syncPendingOperations]);

  return (
    <View className="flex-1 bg-dd-base">
      {syncError && (
        <View className="mx-4 mt-2 rounded-lg bg-red-900/60 px-3 py-2">
          <Text className="text-xs text-red-200">{syncError}</Text>
        </View>
      )}

      <View className="px-4 pt-3 pb-2">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar gravações…"
        />
      </View>

      {meetings.length === 0 && !loading ? (
        <EmptyState
          icon="🎙"
          title="Nenhuma gravação ainda"
          subtitle="Toque em ⊕ para capturar a próxima conversa."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#818cf8" />
          }
          renderSectionHeader={({ section: { title } }) => (
            <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </Text>
          )}
          renderItem={({ item }) => (
            <MeetingCard
              meeting={toCardMeeting(item)}
              onPress={() => navigation.navigate('MeetingDetail', { id: item.id })}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => navigation.navigate('Record')}
        className="absolute bottom-8 right-5 h-14 w-14 items-center justify-center rounded-full bg-indigo-500 shadow-lg active:bg-indigo-600"
      >
        <PlusIcon size={26} color="#0f172a" />
      </Pressable>
    </View>
  );
}
