import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ActionItemRow } from './ActionItemRow';

interface ActionItem { text: string; assignee?: string; completed: boolean; }
interface Decision { text: string; }

interface AINotesViewProps {
  liveNotes: string;
  actionItems: ActionItem[];
  decisions: Decision[];
  onNotesChange: (text: string) => void;
  onGenerateAI: () => void;
  isGenerating?: boolean;
}

/**
 * Granola-style notes panel: editable free-form notes with parsed action items and decisions below.
 */
export function AINotesView({
  liveNotes,
  actionItems,
  decisions,
  onNotesChange,
  onGenerateAI,
  isGenerating = false,
}: AINotesViewProps) {
  return (
    <ScrollView className="flex-1 px-4 py-3" keyboardShouldPersistTaps="handled">
      {/* Free-form notes editor */}
      <TextInput
        className="min-h-[120px] rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm leading-relaxed text-slate-300"
        value={liveNotes}
        onChangeText={onNotesChange}
        multiline
        placeholder="Adicione anotações livres da reunião…"
        placeholderTextColor="#475569"
        textAlignVertical="top"
      />

      {/* Action Items */}
      {actionItems.length > 0 && (
        <View className="mt-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            📋 Action Items
          </Text>
          {actionItems.map((item, i) => (
            <ActionItemRow key={i} item={item} />
          ))}
        </View>
      )}

      {/* Decisions */}
      {decisions.length > 0 && (
        <View className="mt-5">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            ✅ Decisões
          </Text>
          {decisions.map((d, i) => (
            <Text key={i} className="mb-1 text-sm leading-snug text-slate-300">
              • {d.text}
            </Text>
          ))}
        </View>
      )}

      {/* AI generation button */}
      <Pressable
        onPress={onGenerateAI}
        disabled={isGenerating}
        className="mt-6 items-center rounded-xl border border-emerald-800 bg-emerald-950 py-3 active:opacity-70 disabled:opacity-40"
      >
        <Text className="text-sm font-medium text-emerald-400">
          {isGenerating ? 'Gerando…' : 'Gerar notas com IA'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
