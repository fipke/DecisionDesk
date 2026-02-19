import { useState, useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { useMeetings } from '../state/MeetingContext';
import type { RootStackParamList } from '../navigation/AppNavigator';

export type SearchScreenProps = NativeStackScreenProps<RootStackParamList, 'Search'>;

export function SearchScreen({ navigation }: SearchScreenProps) {
  const { meetings } = useMeetings();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return meetings
      .filter((m) => m.title?.toLowerCase().includes(q) || m.transcriptText?.toLowerCase().includes(q))
      .map((m) => {
        const idx = m.transcriptText?.toLowerCase().indexOf(q) ?? -1;
        const snippet =
          idx !== -1 && m.transcriptText
            ? m.transcriptText.substring(Math.max(0, idx - 40), idx + 80)
            : undefined;
        return { meeting: m, snippet };
      });
  }, [meetings, query]);

  return (
    <View className="flex-1 bg-slate-950 px-4 pt-3">
      <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar em todas as reuniões…" />

      {query.length > 0 && results.length === 0 && (
        <EmptyState icon="🔍" title="Sem resultados" subtitle={`Nenhuma reunião encontrada para "${query}"`} />
      )}

      <FlatList
        data={results}
        className="mt-4"
        keyExtractor={(item) => item.meeting.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('MeetingDetail', { id: item.meeting.id })}
            className="mb-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
          >
            <Text className="text-sm font-semibold text-slate-100">{item.meeting.title || 'Reunião'}</Text>
            {item.snippet && (
              <Text className="mt-1 text-xs text-slate-500" numberOfLines={2}>…{item.snippet}…</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}
