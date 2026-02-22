import type { TranscriptSegment, MeetingSpeaker } from '../../../shared/types';
import { SpeakerBadge } from './SpeakerBadge';
import { getSpeakerColor } from './speakerColors';

interface SegmentBlockProps {
  segments: TranscriptSegment[];
  speaker: MeetingSpeaker | null;
  isActive: boolean;
  onSeek: (seconds: number) => void;
  onReassign?: (segmentId: string) => void;
}

function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Renders a group of consecutive segments from the same speaker as one visual block.
 * Each block has a colored left border, speaker badge, timestamp, and merged text.
 */
export function SegmentBlock({ segments, speaker, isActive, onSeek }: SegmentBlockProps) {
  if (segments.length === 0) return null;

  const firstSegment = segments[0];
  const color = speaker ? getSpeakerColor(speaker.colorIndex) : null;
  const borderClass = color ? color.border : 'border-l-slate-600';

  return (
    <div
      className={`rounded-r-lg border-l-[3px] ${borderClass} pl-3 pr-2 py-2 cursor-pointer transition-colors hover:bg-dd-elevated/50 ${
        isActive ? 'ring-2 ring-indigo-500/50 bg-indigo-500/10' : ''
      }`}
      onClick={() => onSeek(firstSegment.startSec)}
    >
      {/* Header: speaker badge + timestamp */}
      <div className="flex items-center justify-between mb-1">
        {speaker ? (
          <SpeakerBadge
            displayName={speaker.displayName}
            label={speaker.label}
            colorIndex={speaker.colorIndex}
          />
        ) : (
          <span className="text-xs text-slate-500">Sem identificação</span>
        )}
        <span className="text-xs text-slate-500 tabular-nums">
          {formatTimestamp(firstSegment.startSec)}
        </span>
      </div>

      {/* Text — merge all segments in the group */}
      <p className="text-sm text-slate-300 leading-relaxed">
        {segments.map(s => s.text.trim()).join(' ')}
      </p>
    </div>
  );
}

/**
 * For non-diarized transcripts: a simpler block with just timestamp and text.
 */
export function TimestampBlock({
  segments,
  isActive,
  onSeek,
}: {
  segments: TranscriptSegment[];
  isActive: boolean;
  onSeek: (seconds: number) => void;
}) {
  if (segments.length === 0) return null;
  const firstSegment = segments[0];

  return (
    <div
      className={`pl-3 pr-2 py-2 cursor-pointer transition-colors hover:bg-dd-elevated/50 rounded-lg ${
        isActive ? 'ring-2 ring-indigo-500/50 bg-indigo-500/10' : ''
      }`}
      onClick={() => onSeek(firstSegment.startSec)}
    >
      <span className="text-xs text-slate-500 tabular-nums">
        {formatTimestamp(firstSegment.startSec)}
      </span>
      <p className="text-sm text-slate-300 leading-relaxed mt-0.5">
        {segments.map(s => s.text.trim()).join(' ')}
      </p>
    </div>
  );
}
