import { ScrollView, Text, View } from 'react-native';

interface TranscriptLine {
  speaker?: string;
  startSec?: number;
  text: string;
}

interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

function highlightMatches(text: string, query: string): HighlightSegment[] {
  if (!query.trim()) return [{ text, highlighted: false }];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  const segments: HighlightSegment[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length === 0) continue;
    segments.push({ text: parts[i], highlighted: i % 2 === 1 });
  }
  return segments.length === 0 ? [{ text, highlighted: false }] : segments;
}

function formatDurationSec(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface HighlightedTextProps {
  text: string;
  query: string;
}

function HighlightedText({ text, query }: HighlightedTextProps) {
  const segments = query ? highlightMatches(text, query) : [{ text, highlighted: false }];
  return (
    <Text className="text-sm leading-relaxed text-slate-300">
      {segments.map((seg, i) =>
        seg.highlighted ? (
          <Text key={i} className="rounded bg-indigo-950 text-indigo-300">{seg.text}</Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        )
      )}
    </Text>
  );
}

interface TranscriptViewProps {
  lines: TranscriptLine[];
  searchQuery?: string;
}

export function TranscriptView({ lines, searchQuery = '' }: TranscriptViewProps) {
  if (lines.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6 py-12">
        <Text className="text-center text-sm text-slate-500">
          A transcrição será exibida aqui após o processamento.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-3">
      {lines.map((line, idx) => (
        <View key={idx} className="mb-4">
          <View className="flex-row items-center gap-2">
            {line.startSec !== undefined && (
              <Text className="font-mono text-xs text-slate-500">
                {formatDurationSec(line.startSec)}
              </Text>
            )}
            {line.speaker && (
              <Text className="text-xs font-semibold text-indigo-400">{line.speaker}</Text>
            )}
          </View>
          <HighlightedText text={line.text} query={searchQuery} />
        </View>
      ))}
    </ScrollView>
  );
}
