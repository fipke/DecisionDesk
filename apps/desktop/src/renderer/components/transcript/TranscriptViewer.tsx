import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Meeting, TranscriptSegment, MeetingSpeaker } from '../../../shared/types';
import type { AudioPlayerHandle } from './AudioPlayerControlled';
import { SegmentBlock, TimestampBlock } from './SegmentBlock';
import { SpeakerPanel } from './SpeakerPanel';
import { TranscriptSearch } from './TranscriptSearch';

// ─── Legacy transcript parsing (for old meetings without segments) ──

interface LegacyTranscriptLine {
  hours: string | null;
  minutes: string;
  seconds: string;
  speaker: string;
  text: string;
}

const TRANSCRIPT_LINE_RE = /^(?:(\d+):)?(\d{2}):(\d{2})\s+([^:]+):\s+(.+)$/;

function parseLegacyTranscript(raw: string): LegacyTranscriptLine[] {
  const result: LegacyTranscriptLine[] = [];
  for (const line of raw.split('\n')) {
    const m = TRANSCRIPT_LINE_RE.exec(line.trim());
    if (!m) continue;
    result.push({
      hours: m[1] ?? null,
      minutes: m[2],
      seconds: m[3],
      speaker: m[4].trim(),
      text: m[5].trim(),
    });
  }
  return result;
}

function formatLegacyTimestamp(line: LegacyTranscriptLine): string {
  if (line.hours) return `${line.hours}:${line.minutes}:${line.seconds}`;
  return `${line.minutes}:${line.seconds}`;
}

// ─── Segment grouping helpers ───────────────────────────────

interface SegmentGroup {
  speakerId: string | null;
  speakerLabel: string | null;
  segments: TranscriptSegment[];
}

/** Group consecutive segments by the same speaker into blocks. */
function groupBySpeaker(segments: TranscriptSegment[]): SegmentGroup[] {
  const groups: SegmentGroup[] = [];
  for (const seg of segments) {
    const last = groups[groups.length - 1];
    if (last && last.speakerId === seg.speakerId && last.speakerLabel === seg.speakerLabel) {
      last.segments.push(seg);
    } else {
      groups.push({
        speakerId: seg.speakerId,
        speakerLabel: seg.speakerLabel,
        segments: [seg],
      });
    }
  }
  return groups;
}

/** Group segments by time gaps (>2s) for non-diarized transcripts. */
function groupByTimeGaps(segments: TranscriptSegment[], gapThreshold = 2): TranscriptSegment[][] {
  const groups: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];

  for (const seg of segments) {
    if (current.length > 0) {
      const lastEnd = current[current.length - 1].endSec;
      if (seg.startSec - lastEnd > gapThreshold) {
        groups.push(current);
        current = [];
      }
    }
    current.push(seg);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

// ─── Main component ─────────────────────────────────────────

interface TranscriptViewerProps {
  meeting: Meeting;
  audioRef: React.RefObject<AudioPlayerHandle | null>;
  onRetranscribe?: () => void;
}

export function TranscriptViewer({ meeting, audioRef, onRetranscribe }: TranscriptViewerProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  const activeBlockRef = useRef<HTMLDivElement>(null);

  // Load structured segments
  const { data: segments = [] } = useQuery({
    queryKey: ['segments', meeting.id],
    queryFn: () => window.electronAPI.db.listSegments(meeting.id),
  });

  // Load speakers
  const { data: speakers = [] } = useQuery({
    queryKey: ['speakers', meeting.id],
    queryFn: () => window.electronAPI.db.listMeetingSpeakers(meeting.id),
  });

  // Track audio playback time
  useEffect(() => {
    const player = audioRef.current;
    if (!player) return;
    const handler = () => setCurrentTime(player.getCurrentTime());
    player.addEventListener('timeupdate', handler);
    return () => player.removeEventListener('timeupdate', handler);
  }, [audioRef]);

  // Auto-scroll to active block
  useEffect(() => {
    if (autoScroll && activeBlockRef.current) {
      activeBlockRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime, autoScroll]);

  const handleSeek = useCallback((seconds: number) => {
    audioRef.current?.seek(seconds);
  }, [audioRef]);

  // Diarization mutation
  const diarizeMutation = useMutation({
    mutationFn: async () => {
      let audioPath = meeting.recordingUri;
      if (!audioPath) {
        audioPath = await window.electronAPI.api.downloadAudio(meeting.id);
      }

      // Run diarization
      const diarization = await window.electronAPI.whisper.diarize(audioPath);

      // Load current segments
      const currentSegments = await window.electronAPI.db.listSegments(meeting.id);
      if (currentSegments.length === 0) {
        throw new Error('Nenhum segmento encontrado. Transcreva primeiro antes de identificar speakers.');
      }

      // Merge diarization results with existing segments
      const speakerLabels = [...new Set(diarization.segments.map(s => s.speaker))];
      const speakerMap = new Map<string, string>();

      // Delete existing speakers and re-create
      await window.electronAPI.db.deleteSegments(meeting.id);

      for (let i = 0; i < speakerLabels.length; i++) {
        const spk = await window.electronAPI.db.upsertMeetingSpeaker({
          meetingId: meeting.id,
          label: speakerLabels[i],
          colorIndex: i % 8,
          talkTimeSec: 0,
        });
        speakerMap.set(speakerLabels[i], spk.id);
      }

      // Re-insert segments with speaker labels from diarization
      const updatedSegments = currentSegments.map((seg, idx) => {
        const midpoint = (seg.startSec + seg.endSec) / 2;
        let matchedSpeaker: string | null = null;
        for (const ds of diarization.segments) {
          if (ds.start <= midpoint && midpoint <= ds.end) {
            matchedSpeaker = ds.speaker;
            break;
          }
        }
        return {
          meetingId: meeting.id,
          ordinal: idx,
          startSec: seg.startSec,
          endSec: seg.endSec,
          text: seg.text,
          speakerLabel: matchedSpeaker ?? 'UNKNOWN',
          speakerId: matchedSpeaker ? (speakerMap.get(matchedSpeaker) ?? null) : null,
        };
      });

      await window.electronAPI.db.insertSegmentsBatch(meeting.id, updatedSegments);

      // Update talk time stats
      for (const [label, speakerId] of speakerMap) {
        const talkTime = updatedSegments
          .filter(s => s.speakerLabel === label)
          .reduce((sum, s) => sum + (s.endSec - s.startSec), 0);
        await window.electronAPI.db.upsertMeetingSpeaker({
          id: speakerId,
          meetingId: meeting.id,
          label,
          colorIndex: speakerLabels.indexOf(label) % 8,
          talkTimeSec: talkTime,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments', meeting.id] });
      queryClient.invalidateQueries({ queryKey: ['speakers', meeting.id] });
    },
  });

  // Determine display mode
  const hasSegments = segments.length > 0;
  const hasSpeakers = speakers.length > 0;
  const hasLegacyText = !hasSegments && !!meeting.transcriptText;

  if (!hasSegments && !hasLegacyText) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <svg className="h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="mt-4 text-slate-400">Nenhuma transcrição disponível.</p>
      </div>
    );
  }

  // ─── Legacy text display ──────────────────────────────────

  if (hasLegacyText) {
    return <LegacyTranscriptView text={meeting.transcriptText!} search={search} onSearchChange={setSearch} onRetranscribe={onRetranscribe} />;
  }

  // ─── Structured segment display ───────────────────────────

  const totalDuration = speakers.reduce((sum, s) => sum + s.talkTimeSec, 0) || (meeting.durationSec ?? 0);

  // Filter segments
  const filtered = segments.filter((seg) => {
    if (speakerFilter && seg.speakerId !== speakerFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const speaker = speakers.find(s => s.id === seg.speakerId);
      const speakerName = speaker?.displayName ?? speaker?.label ?? '';
      return seg.text.toLowerCase().includes(q) || speakerName.toLowerCase().includes(q);
    }
    return true;
  });

  // Find active segment
  const activeSegmentId = filtered.find(
    s => s.startSec <= currentTime && currentTime < s.endSec
  )?.id ?? null;

  if (hasSpeakers) {
    // ── With diarization: two-column layout ──
    const groups = groupBySpeaker(filtered);
    const speakerMap = new Map(speakers.map(s => [s.id, s]));

    return (
      <div className="flex gap-4 h-full">
        {/* Left: transcript */}
        <div className="flex-1 min-w-0 space-y-3 overflow-auto">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <TranscriptSearch value={search} onChange={setSearch} />
            </div>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`rounded-md border px-2 py-1.5 text-xs transition-colors shrink-0 ${
                autoScroll
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                  : 'border-dd-border text-slate-400 hover:text-slate-200'
              }`}
              title="Auto-scroll durante reprodução"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>

          {filtered.length === 0 && search.trim() ? (
            <p className="text-center text-sm text-slate-500">Nenhum resultado encontrado.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((group, gi) => {
                const speaker = group.speakerId ? speakerMap.get(group.speakerId) ?? null : null;
                const isActive = group.segments.some(s => s.id === activeSegmentId);
                return (
                  <div key={gi} ref={isActive ? activeBlockRef : undefined}>
                    <SegmentBlock
                      segments={group.segments}
                      speaker={speaker}
                      isActive={isActive}
                      onSeek={handleSeek}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: speaker panel */}
        <div className="w-56 shrink-0 overflow-auto">
          <SpeakerPanel
            meetingId={meeting.id}
            speakers={speakers}
            totalDuration={totalDuration}
            onRunDiarization={() => diarizeMutation.mutate()}
            isDiarizing={diarizeMutation.isPending}
            hasDiarization={true}
            onFilterSpeaker={setSpeakerFilter}
            activeSpeakerFilter={speakerFilter}
          />
        </div>
      </div>
    );
  }

  // ── Without diarization: full-width, grouped by time gaps ──
  const timeGroups = groupByTimeGaps(filtered);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TranscriptSearch value={search} onChange={setSearch} />
        </div>
        <button
          onClick={() => diarizeMutation.mutate()}
          disabled={diarizeMutation.isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 shrink-0"
        >
          {diarizeMutation.isPending ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Identificando...
            </span>
          ) : (
            'Identificar speakers'
          )}
        </button>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`rounded-md border px-2 py-1.5 text-xs transition-colors shrink-0 ${
            autoScroll
              ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
              : 'border-dd-border text-slate-400 hover:text-slate-200'
          }`}
          title="Auto-scroll durante reprodução"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>

      {filtered.length === 0 && search.trim() ? (
        <p className="text-center text-sm text-slate-500">Nenhum resultado encontrado.</p>
      ) : (
        <div className="space-y-2">
          {timeGroups.map((group, gi) => {
            const isActive = group.some(s => s.id === activeSegmentId);
            return (
              <div key={gi} ref={isActive ? activeBlockRef : undefined}>
                <TimestampBlock
                  segments={group}
                  isActive={isActive}
                  onSeek={handleSeek}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-center gap-2 rounded-lg border border-blue-800/40 bg-blue-950/30 px-4 py-3">
        <svg className="h-4 w-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-300">
          Sem identificação de speakers. Clique em "Identificar speakers" para identificar quem falou cada trecho.
        </p>
      </div>
    </div>
  );
}

// ─── Legacy view for old meetings ───────────────────────────

function LegacyTranscriptView({
  text,
  search,
  onSearchChange,
  onRetranscribe,
}: {
  text: string;
  search: string;
  onSearchChange: (v: string) => void;
  onRetranscribe?: () => void;
}) {
  const lines = useMemo(() => parseLegacyTranscript(text), [text]);

  const filtered = lines.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return l.speaker.toLowerCase().includes(q) || l.text.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <TranscriptSearch value={search} onChange={onSearchChange} />

      {/* Legacy banner */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-800/40 bg-amber-950/30 px-4 py-3">
        <svg className="h-4 w-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="flex-1 text-xs text-amber-300">
          Formato legado. Re-transcreva para ter recursos interativos (click-to-seek, gestão de speakers).
        </p>
        {onRetranscribe && (
          <button
            onClick={onRetranscribe}
            className="shrink-0 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500"
          >
            Re-transcrever
          </button>
        )}
      </div>

      {filtered.length === 0 && search.trim() ? (
        <p className="text-center text-sm text-slate-500">Nenhum resultado encontrado.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{text}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((line, i) => (
            <div key={i} className="rounded-lg border border-dd-border bg-dd-surface p-3">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-medium text-sm text-indigo-400">{line.speaker}</span>
                <span className="text-xs text-slate-500">{formatLegacyTimestamp(line)}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{line.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
