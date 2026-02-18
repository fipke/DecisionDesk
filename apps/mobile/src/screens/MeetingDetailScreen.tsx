import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { AINotesView } from '../components/AINotesView';
import { PrimaryButton } from '../components/PrimaryButton';
import { SearchBar } from '../components/SearchBar';
import { StatusBadge } from '../components/StatusBadge';
import { SummaryView } from '../components/SummaryView';
import { TabBar } from '../components/TabBar';
import { TranscribeModal, type TranscribeModalOptions } from '../components/TranscribeModal';
import { TranscriptView } from '../components/TranscriptView';
import { useNetworkGuard } from '../hooks/useNetworkGuard';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { notesService, type ActionItem, type Decision, type MeetingNotes } from '../services/notesService';
import { useMeetings } from '../state/MeetingContext';
import { useSettings } from '../state/SettingsContext';

// Inline speaker line parser (avoids @decisiondesk/utils bundler issue)
interface TranscriptLine {
  speaker?: string;
  startSec?: number;
  text: string;
}

const SPEAKER_LINE_RE = /^(?:(\d+):)?(\d{2}):(\d{2})\s+([^:]+):\s+(.+)$/;

function parseSpeakerLine(raw: string): TranscriptLine | null {
  const m = raw.match(SPEAKER_LINE_RE);
  if (!m) return null;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const minutes = parseInt(m[2], 10);
  const seconds = parseInt(m[3], 10);
  return { speaker: m[4].trim(), startSec: hours * 3600 + minutes * 60 + seconds, text: m[5].trim() };
}

type DetailTab = 'transcript' | 'notes' | 'summary';

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'transcript', label: 'Transcrição' },
  { key: 'notes', label: 'Notas' },
  { key: 'summary', label: 'Resumo' },
];

export type MeetingDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'MeetingDetail'>;

export function MeetingDetailScreen({ route, navigation }: MeetingDetailScreenProps) {
  const { meetings, refreshMeeting, transcribeMeeting } = useMeetings();
  const { transcription } = useSettings();
  const { ensureAllowedConnection } = useNetworkGuard();

  const [activeTab, setActiveTab] = useState<DetailTab>('transcript');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [showTranscribeModal, setShowTranscribeModal] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [notes, setNotes] = useState<MeetingNotes>({});
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const meeting = useMemo(
    () => meetings.find((m) => m.id === route.params.id),
    [meetings, route.params.id]
  );

  useFocusEffect(
    useCallback(() => {
      if (meeting?.remoteId) refreshMeeting(meeting.id);
    }, [meeting?.remoteId, meeting?.id, refreshMeeting])
  );

  useEffect(() => {
    if (!meeting?.remoteId) return;
    const id = meeting.remoteId;
    notesService.getNotes(id).then(setNotes).catch(() => {});
    notesService.getActionItems(id).then(setActionItems).catch(() => {});
    notesService.getDecisions(id).then(setDecisions).catch(() => {});
  }, [meeting?.remoteId]);

  const transcriptLines: TranscriptLine[] = useMemo(() => {
    if (!meeting?.transcriptText) return [];
    return meeting.transcriptText
      .split('\n')
      .filter(Boolean)
      .map((line) => parseSpeakerLine(line) ?? { text: line });
  }, [meeting?.transcriptText]);

  const handleTranscribe = useCallback(
    async (options: TranscribeModalOptions) => {
      if (!meeting) return;
      setShowTranscribeModal(false);
      try {
        await ensureAllowedConnection();
        setTranscribing(true);
        await transcribeMeeting(meeting.id, options);
        Alert.alert('Pedido enviado', 'A transcrição foi iniciada.');
      } catch {
        Alert.alert('Erro', 'Não foi possível solicitar a transcrição.');
      } finally {
        setTranscribing(false);
      }
    },
    [ensureAllowedConnection, meeting, transcribeMeeting]
  );

  // Adaptation: AINotesView.onNotesChange is (text: string) => void (sync).
  // handleSaveNotes is async, so we wrap it in a fire-and-forget sync callback.
  const handleSaveNotes = useCallback(
    async (content: string) => {
      if (!meeting?.remoteId) return;
      setNotes((n) => ({ ...n, liveNotesMd: content }));
      await notesService.saveLiveNotes(meeting.remoteId, content).catch(() => {});
    },
    [meeting?.remoteId]
  );

  const handleNotesChange = useCallback(
    (text: string) => {
      void handleSaveNotes(text);
    },
    [handleSaveNotes]
  );

  if (!meeting) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-950">
        <Text className="text-slate-400">Reunião não encontrada.</Text>
      </View>
    );
  }

  const hasTranscript = Boolean(meeting.transcriptText);

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="border-b border-slate-800 px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 pr-2 text-base font-semibold text-slate-100" numberOfLines={1}>
            {meeting.title || 'Reunião'}
          </Text>
          <StatusBadge status={meeting.status} />
        </View>
        {!hasTranscript && (
          <View className="mt-2">
            <PrimaryButton
              title={transcribing ? 'Aguarde…' : 'Transcrever agora'}
              onPress={() => setShowTranscribeModal(true)}
              disabled={transcribing || !meeting.remoteId}
            />
          </View>
        )}
      </View>

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'transcript' && (
        <View className="flex-1">
          <View className="px-4 py-2">
            <SearchBar
              value={transcriptSearch}
              onChangeText={setTranscriptSearch}
              placeholder="Buscar na transcrição…"
            />
          </View>
          <TranscriptView lines={transcriptLines} searchQuery={transcriptSearch} />
        </View>
      )}

      {activeTab === 'notes' && (
        <AINotesView
          liveNotes={notes.liveNotesMd ?? ''}
          actionItems={actionItems}
          decisions={decisions}
          onNotesChange={handleNotesChange}
          onGenerateAI={() =>
            Alert.alert('Em breve', 'Geração de notas com IA será adicionada.')
          }
        />
      )}

      {activeTab === 'summary' && (
        <SummaryView
          onGenerate={() =>
            Alert.alert('Em breve', 'Geração de resumo será adicionada.')
          }
        />
      )}

      <TranscribeModal
        visible={showTranscribeModal}
        defaultProvider={transcription.defaultProvider}
        defaultModel={transcription.defaultModel}
        defaultDiarization={transcription.enableDiarization}
        onConfirm={handleTranscribe}
        onCancel={() => setShowTranscribeModal(false)}
      />
    </View>
  );
}
