import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PlusIcon, StarIcon, TrashIcon, XMarkIcon } from 'react-native-heroicons/outline';
import { StarIcon as StarSolid } from 'react-native-heroicons/solid';
import { EmptyState } from '../components/EmptyState';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  type SummaryTemplate,
} from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

export type TemplatesScreenProps = NativeStackScreenProps<RootStackParamList, 'Templates'>;

// ─── Form Modal ───────────────────────────────────────────────

function TemplateFormModal({
  visible,
  template,
  onClose,
  onSaved,
}: {
  visible: boolean;
  template: SummaryTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPromptTemplate, setUserPromptTemplate] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(template?.name ?? '');
      setDescription(template?.description ?? '');
      setSystemPrompt(template?.systemPrompt ?? '');
      setUserPromptTemplate(template?.userPromptTemplate ?? '');
      setModel(template?.model ?? 'gpt-4o');
    }
  }, [visible, template]);

  const handleSave = async () => {
    if (!name.trim() || !systemPrompt.trim() || !userPromptTemplate.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim(),
        userPromptTemplate: userPromptTemplate.trim(),
        model,
        maxTokens: 2048,
        temperature: 0.3,
        outputFormat: 'markdown',
      };
      if (template) {
        await updateTemplate(template.id, payload);
      } else {
        await createTemplate(payload);
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[85%] rounded-t-2xl bg-dd-surface px-5 pb-10 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-slate-100">
              {template ? 'Editar template' : 'Novo template'}
            </Text>
            <Pressable onPress={onClose} className="p-1">
              <XMarkIcon size={20} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="mb-1 text-xs font-medium text-slate-400">Nome *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: Ata de reunião"
              placeholderTextColor="#475569"
              className="mb-3 rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100"
              autoFocus
            />

            <Text className="mb-1 text-xs font-medium text-slate-400">Descrição</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Descrição opcional..."
              placeholderTextColor="#475569"
              className="mb-3 rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100"
            />

            <Text className="mb-1 text-xs font-medium text-slate-400">Prompt do sistema *</Text>
            <TextInput
              value={systemPrompt}
              onChangeText={setSystemPrompt}
              placeholder="Instruções para o modelo..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={4}
              className="mb-3 rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100"
            />

            <Text className="mb-1 text-xs font-medium text-slate-400">Template do prompt *</Text>
            <TextInput
              value={userPromptTemplate}
              onChangeText={setUserPromptTemplate}
              placeholder="Template com variáveis..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={4}
              className="mb-3 rounded-lg border border-dd-border bg-dd-elevated px-3 py-2.5 text-sm text-slate-100"
            />

            <Text className="mb-1 text-xs font-medium text-slate-400">Modelo</Text>
            <View className="mb-5 flex-row gap-2">
              {['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'].map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setModel(m)}
                  className={`rounded-full border px-3 py-1.5 ${
                    model === m
                      ? 'border-indigo-500 bg-indigo-500/20'
                      : 'border-dd-border bg-dd-elevated'
                  }`}
                >
                  <Text className={`text-xs ${model === m ? 'text-indigo-300' : 'text-slate-400'}`}>
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Pressable
            onPress={handleSave}
            disabled={!name.trim() || !systemPrompt.trim() || !userPromptTemplate.trim() || saving}
            className="items-center rounded-xl bg-indigo-600 py-3 active:bg-indigo-700 disabled:opacity-50"
          >
            <Text className="font-semibold text-white">
              {saving ? 'Salvando...' : template ? 'Salvar' : 'Criar template'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export function TemplatesScreen({}: TemplatesScreenProps) {
  const [templates, setTemplates] = useState<SummaryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SummaryTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch {
      // offline or error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleDelete = (t: SummaryTemplate) => {
    Alert.alert('Excluir template', `Deseja excluir "${t.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTemplate(t.id);
            loadTemplates();
          } catch {
            Alert.alert('Erro', 'Não foi possível excluir.');
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (t: SummaryTemplate) => {
    try {
      await setDefaultTemplate(t.id);
      loadTemplates();
    } catch {
      Alert.alert('Erro', 'Não foi possível definir como padrão.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-dd-base">
        <Text className="text-slate-500">Carregando...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dd-base px-4 pt-4">
      {templates.length === 0 ? (
        <EmptyState
          icon="📝"
          title="Nenhum template"
          subtitle="Crie templates de resumo para suas reuniões."
        />
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setEditingTemplate(item);
                setModalVisible(true);
              }}
              className="mb-2 rounded-xl border border-dd-border bg-dd-surface px-4 py-3"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-medium text-slate-100">{item.name}</Text>
                    {item.isDefault && <StarSolid size={14} color="#eab308" />}
                  </View>
                  {item.description && (
                    <Text className="mt-0.5 text-xs text-slate-400" numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                  {item.model && (
                    <Text className="mt-1 text-xs text-slate-500">{item.model}</Text>
                  )}
                </View>
                <View className="flex-row gap-2">
                  <Pressable onPress={() => handleSetDefault(item)} className="p-2">
                    {item.isDefault ? (
                      <StarSolid size={16} color="#eab308" />
                    ) : (
                      <StarIcon size={16} color="#94a3b8" />
                    )}
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} className="p-2">
                    <TrashIcon size={16} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => {
          setEditingTemplate(null);
          setModalVisible(true);
        }}
        className="absolute bottom-8 right-5 h-14 w-14 items-center justify-center rounded-full bg-indigo-500 shadow-lg active:bg-indigo-600"
      >
        <PlusIcon size={26} color="#0f172a" />
      </Pressable>

      <TemplateFormModal
        visible={modalVisible}
        template={editingTemplate}
        onClose={() => setModalVisible(false)}
        onSaved={loadTemplates}
      />
    </View>
  );
}
