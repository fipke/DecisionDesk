import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { PlayIcon, PauseIcon } from 'react-native-heroicons/solid';

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
import { fetchSummary, fetchTemplates, generateSummary, getAudioUrl, type SummaryTemplate } from '../services/api';
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

// ─── Audio Player ─────────────────────────────────────────────

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function AudioPlayer({ localUri, remoteId }: { localUri: string | null; remoteId: string | null }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(localUri);

  useEffect(() => {
    if (!localUri && remoteId) {
      getAudioUrl(remoteId).then(setAudioUri).catch(() => {});
    }
  }, [localUri, remoteId]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const loadAndPlay = async () => {
    if (!audioUri) return;

    if (!loaded) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setPositionMs(status.positionMillis);
              setDurationMs(status.durationMillis ?? 0);
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPositionMs(0);
              }
            }
          }
        );
        soundRef.current = sound;
        setLoaded(true);
        setIsPlaying(true);
      } catch {
        Alert.alert('Erro', 'Não foi possível reproduzir o áudio.');
      }
    } else if (soundRef.current) {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    }
  };

  if (!audioUri) return null;

  return (
    <View className="mx-4 mt-2 flex-row items-center gap-3 rounded-lg border border-dd-border bg-dd-surface px-3 py-2">
      <Pressable onPress={loadAndPlay} className="h-8 w-8 items-center justify-center rounded-full bg-indigo-600">
        {isPlaying ? <PauseIcon size={16} color="#fff" /> : <PlayIcon size={16} color="#fff" />}
      </Pressable>
      <View className="flex-1">
        <View className="h-1 rounded-full bg-dd-elevated">
          <View
            className="h-1 rounded-full bg-indigo-500"
            style={{ width: durationMs > 0 ? `${(positionMs / durationMs) * 100}%` : '0%' }}
          />
        </View>
      </View>
      <Text className="text-xs text-slate-400">
        {formatTime(positionMs)}{durationMs > 0 ? ` / ${formatTime(durationMs)}` : ''}
      </Text>
    </View>
  );
}

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
  const [templates, setTemplates] = useState<SummaryTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [summary, setSummary] = useState<{ text: string } | null>(null);
  const [generating, setGenerating] = useState(false);

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

  useEffect(() => {
    fetchTemplates()
      .then((ts) => {
        setTemplates(ts);
        const def = ts.find((t) => t.isDefault);
        if (def) setSelectedTemplateId(def.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!meeting?.remoteId) return;
    fetchSummary(meeting.remoteId).then(setSummary).catch(() => {});
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

  const handleGenerateSummary = useCallback(
    async (templateId?: string) => {
      if (!meeting?.remoteId) return;
      try {
        setGenerating(true);
        const result = await generateSummary(meeting.remoteId, templateId);
        setSummary({ text: result.text });
      } catch {
        Alert.alert('Erro', 'Não foi possível gerar o resumo.');
      } finally {
        setGenerating(false);
      }
    },
    [meeting?.remoteId]
  );

  if (!meeting) {
    return (
      <View className="flex-1 items-center justify-center bg-dd-base">
        <Text className="text-slate-400">Gravação não encontrada.</Text>
      </View>
    );
  }

  const hasTranscript = Boolean(meeting.transcriptText);

  return (
    <View className="flex-1 bg-dd-base">
      {/* Header */}
      <View className="border-b border-dd-border px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 pr-2 text-base font-semibold text-slate-100" numberOfLines={1}>
            {meeting.title || 'Gravação'}
          </Text>
          <StatusBadge status={meeting.status} />
        </View>
        <Text className="mt-1 text-xs text-slate-500">
          {new Date(meeting.createdAt).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
          {(() => {
            const totalSec = meeting.durationSec ?? (meeting.minutes != null && meeting.minutes > 0 ? Math.round(meeting.minutes * 60) : null);
            if (totalSec == null || totalSec <= 0) return null;
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            if (m === 0) return ` · ${s}s`;
            return s > 0 ? ` · ${m}m ${s}s` : ` · ${m} min`;
          })()}
        </Text>
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

      <AudioPlayer localUri={meeting.recordingUri} remoteId={meeting.remoteId} />

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
          summaryMd={summary?.text}
          isGenerating={generating}
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={setSelectedTemplateId}
          onGenerate={handleGenerateSummary}
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
