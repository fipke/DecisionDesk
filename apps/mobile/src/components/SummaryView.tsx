import { Pressable, ScrollView, Text, View } from 'react-native';

interface SummaryTemplate { id: string; name: string; }

interface SummaryViewProps {
  summaryMd?: string;
  isGenerating?: boolean;
  templates?: SummaryTemplate[];
  selectedTemplateId?: string;
  onSelectTemplate?: (id: string) => void;
  onGenerate: (templateId?: string) => void;
}

/**
 * Displays a GPT summary (markdown text) or a "Generate Summary" CTA if none exists.
 * Shows template chip selectors above the generate button.
 */
export function SummaryView({
  summaryMd,
  isGenerating = false,
  templates = [],
  selectedTemplateId,
  onSelectTemplate,
  onGenerate,
}: SummaryViewProps) {
  if (summaryMd) {
    return (
      <ScrollView className="flex-1 px-4 py-3">
        <Text className="text-sm leading-relaxed text-slate-300">{summaryMd}</Text>
        <Pressable
          onPress={() => onGenerate(selectedTemplateId)}
          disabled={isGenerating}
          className="mt-6 items-center rounded-xl border border-slate-700 py-3 active:opacity-70 disabled:opacity-40"
        >
          <Text className="text-sm text-slate-400">
            {isGenerating ? 'Gerando…' : 'Regenerar resumo'}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      {templates.length > 0 && (
        <View className="mb-6 flex-row flex-wrap justify-center gap-2">
          {templates.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => onSelectTemplate?.(t.id)}
              className={`rounded-full px-4 py-1.5 ${
                selectedTemplateId === t.id ? 'bg-emerald-600' : 'bg-slate-800'
              }`}
            >
              <Text
                className={`text-sm ${
                  selectedTemplateId === t.id ? 'text-white' : 'text-slate-300'
                }`}
              >
                {t.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => onGenerate(selectedTemplateId)}
        disabled={isGenerating}
        className="rounded-xl bg-emerald-600 px-8 py-3 active:bg-emerald-700 disabled:opacity-50"
      >
        <Text className="text-sm font-semibold text-white">
          {isGenerating ? 'Gerando…' : 'Gerar Resumo'}
        </Text>
      </Pressable>
    </View>
  );
}
