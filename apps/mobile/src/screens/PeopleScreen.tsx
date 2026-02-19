import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from 'react-native-heroicons/outline';
import { SearchBar } from '../components/SearchBar';
import { EmptyState } from '../components/EmptyState';
import { peopleService, type Person } from '../services/peopleService';
import type { RootStackParamList } from '../navigation/AppNavigator';

export type PeopleScreenProps = NativeStackScreenProps<RootStackParamList, 'People'>;

// ─── Form Modal ───────────────────────────────────────────────

function PersonFormModal({
  visible,
  person,
  onClose,
  onSaved,
}: {
  visible: boolean;
  person: Person | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDisplayName(person?.displayName ?? '');
      setFullName(person?.fullName ?? '');
      setEmail(person?.email ?? '');
      setNotes(person?.notes ?? '');
    }
  }, [visible, person]);

  const handleSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const payload = {
        displayName: trimmed,
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (person) {
        await peopleService.updatePerson(person.id, payload);
      } else {
        await peopleService.createPerson(payload);
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-2xl bg-dd-surface px-5 pb-10 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-slate-100">
              {person ? 'Editar pessoa' : 'Adicionar pessoa'}
            </Text>
            <Pressable onPress={onClose} className="p-1">
              <XMarkIcon size={20} color="#94a3b8" />
            </Pressable>
          </View>

          <Text className="mb-1 text-xs font-medium text-slate-400">Nome de exibição *</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Ex: João"
            placeholderTextColor="#475569"
            className="mb-3 rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100"
            autoFocus
          />

          <Text className="mb-1 text-xs font-medium text-slate-400">Nome completo</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ex: João da Silva"
            placeholderTextColor="#475569"
            className="mb-3 rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100"
          />

          <Text className="mb-1 text-xs font-medium text-slate-400">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="joao@exemplo.com"
            placeholderTextColor="#475569"
            keyboardType="email-address"
            autoCapitalize="none"
            className="mb-3 rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100"
          />

          <Text className="mb-1 text-xs font-medium text-slate-400">Notas</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Observações..."
            placeholderTextColor="#475569"
            multiline
            numberOfLines={3}
            className="mb-5 rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100"
          />

          <Pressable
            onPress={handleSave}
            disabled={!displayName.trim() || saving}
            className="items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
          >
            <Text className="font-semibold text-white">
              {saving ? 'Salvando...' : person ? 'Salvar' : 'Adicionar'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export function PeopleScreen({}: PeopleScreenProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const loadPeople = useCallback(() => {
    peopleService.listPeople(search || undefined).then(setPeople).catch(() => {});
  }, [search]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleDelete = (person: Person) => {
    Alert.alert(
      'Excluir pessoa',
      `Deseja excluir "${person.displayName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await peopleService.deletePerson(person.id);
              loadPeople();
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir.');
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-dd-base px-4 pt-4">
      <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar pessoas…" />
      {people.length === 0 && (
        <EmptyState icon="👥" title="Nenhuma pessoa" subtitle="Adicione participantes às gravações." />
      )}
      <FlatList
        data={people}
        className="mt-4"
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setEditingPerson(item);
              setModalVisible(true);
            }}
            className="mb-2 flex-row items-center gap-3 rounded-xl border border-dd-border bg-dd-surface px-4 py-3"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-indigo-800">
              <Text className="font-semibold text-indigo-200">{item.displayName[0].toUpperCase()}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-slate-100">{item.displayName}</Text>
              {item.email && <Text className="text-xs text-slate-400">{item.email}</Text>}
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  setEditingPerson(item);
                  setModalVisible(true);
                }}
                className="p-2"
              >
                <PencilIcon size={16} color="#94a3b8" />
              </Pressable>
              <Pressable onPress={() => handleDelete(item)} className="p-2">
                <TrashIcon size={16} color="#ef4444" />
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      {/* FAB */}
      <Pressable
        onPress={() => {
          setEditingPerson(null);
          setModalVisible(true);
        }}
        className="absolute bottom-8 right-5 h-14 w-14 items-center justify-center rounded-full bg-indigo-500 shadow-lg active:bg-indigo-600"
      >
        <PlusIcon size={26} color="#0f172a" />
      </Pressable>

      <PersonFormModal
        visible={modalVisible}
        person={editingPerson}
        onClose={() => setModalVisible(false)}
        onSaved={loadPeople}
      />
    </View>
  );
}
