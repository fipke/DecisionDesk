import type { HighlightSegment, TranscriptLine } from '@decisiondesk/types';

// ─── Duration ──────────────────────────────────────────────────

/** Format milliseconds as MM:SS string. */
export function formatDuration(ms: number): string {
  return formatDurationSec(Math.floor(ms / 1000));
}

/** Format seconds as MM:SS string. */
export function formatDurationSec(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Date ──────────────────────────────────────────────────────

/** Format an ISO date string as a relative label in pt-BR: "Hoje", "Ontem", or a short date. */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === todayStr) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';

  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

/**
 * Group an array of items by relative date label (Hoje, Ontem, etc).
 * @param items - Array of items to group
 * @param getDate - Function to extract ISO date string from each item
 */
export function groupByDate<T>(
  items: T[],
  getDate: (item: T) => string,
): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = formatRelativeDate(getDate(item));
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

// ─── Search highlight ──────────────────────────────────────────

/**
 * Split text into segments marked as highlighted or plain, for a given search query.
 * Case-insensitive. Returns a single plain segment if query is empty or has no match.
 */
export function highlightMatches(
  text: string,
  query: string,
): HighlightSegment[] {
  if (!query.trim()) return [{ text, highlighted: false }];

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  const segments: HighlightSegment[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length === 0) continue;
    // After split with one capturing group, odd indices are always the captured match
    segments.push({ text: parts[i], highlighted: i % 2 === 1 });
  }

  if (segments.length === 0) return [{ text, highlighted: false }];
  return segments;
}

// ─── Transcript parsing ────────────────────────────────────────

// Matches: [HH:]MM:SS SpeakerName: transcript text
const SPEAKER_LINE_RE = /^(?:(\d+):)?(\d{2}):(\d{2})\s+([^:]+):\s+(.+)$/;

/**
 * Parse a raw transcript line in the format "MM:SS Speaker: text".
 * Returns null if the line does not match the expected format.
 */
export function parseSpeakerLine(raw: string): TranscriptLine | null {
  const m = raw.match(SPEAKER_LINE_RE);
  if (!m) return null;

  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const minutes = parseInt(m[2], 10);
  const seconds = parseInt(m[3], 10);
  const startSec = hours * 3600 + minutes * 60 + seconds;

  return { speaker: m[4].trim(), startSec, text: m[5].trim() };
}

/** Extract unique speaker names from an array of transcript lines. */
export function extractSpeakers(lines: Pick<TranscriptLine, 'speaker'>[]): string[] {
  return [...new Set(lines.map((l) => l.speaker).filter((s): s is string => Boolean(s)))];
}

// ─── Currency ─────────────────────────────────────────────────

/** Format a number as Brazilian Real currency string. */
export function toBRL(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Format a nullable amount as currency, returning "—" for null. */
export function formatCurrency(
  amount: number | null,
  currency: 'BRL' | 'USD',
): string {
  if (amount === null) return '—';
  if (currency === 'BRL') return toBRL(amount);
  return `$${amount.toFixed(4)}`;
}
