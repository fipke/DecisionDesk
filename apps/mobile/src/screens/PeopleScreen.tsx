import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { peopleService, type Person } from '../services/peopleService';
import type { RootStackParamList } from '../navigation/AppNavigator';

export type PeopleScreenProps = NativeStackScreenProps<RootStackParamList, 'People'>;

export function PeopleScreen({}: PeopleScreenProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    peopleService.listPeople(search || undefined).then(setPeople).catch(() => {});
  }, [search]);

  return (
    <View className="flex-1 bg-slate-950 px-4 pt-4">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar pessoas…" />
      {people.length === 0 && (
        <EmptyState icon="👥" title="Nenhuma pessoa" subtitle="Adicione participantes às reuniões." />
      )}
      <FlatList
        data={people}
        className="mt-4"
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View className="mb-2 flex-row items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-800">
              <Text className="font-semibold text-emerald-200">{item.displayName[0].toUpperCase()}</Text>
            </View>
            <View>
              <Text className="text-sm font-medium text-slate-100">{item.displayName}</Text>
              {item.email && <Text className="text-xs text-slate-400">{item.email}</Text>}
            </View>
          </View>
        )}
      />
    </View>
  );
}
