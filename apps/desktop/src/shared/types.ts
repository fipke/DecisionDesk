// ───────────────────────────────────────────────────────────────
// Shared types for DecisionDesk Desktop (offline-first)
// Mirror of mobile/src/types/index.ts + desktop-specific extras
// ───────────────────────────────────────────────────────────────

export type MeetingStatus = 'PENDING_SYNC' | 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';

export type TranscriptionProvider = 'desktop_local' | 'server_local' | 'remote_openai';
export type WhisperModel = 'large-v3' | 'medium' | 'small' | 'base' | 'tiny';

// ─── Core entities ───────────────────────────────────────────

export interface Meeting {
  id: string;
  remoteId: string | null;
  createdAt: string;
  status: MeetingStatus;
  recordingUri: string | null;
  transcriptText: string | null;
  language: string | null;
  costUsd: number | null;
  costBrl: number | null;
  minutes: number | null;
  folderId: string | null;
  meetingTypeId: string | null;
  tags: Record<string, string>;
  title: string | null;
  updatedAt: string | null;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  defaultTags: Record<string, string>;
  defaultWhisperModel: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface MeetingType {
  id: string;
  name: string;
  description: string | null;
  requiredTags: Record<string, string>;
  defaultWhisperModel: string | null;
  createdAt: string;
  synced: boolean;
}

export interface Person {
  id: string;
  displayName: string;
  fullName: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export type PersonRole = 'participant' | 'mentioned';

export interface MeetingPerson {
  meetingId: string;
  personId: string;
  role: PersonRole;
  createdAt: string;
}

// ─── Notes (PR09-style structured blocks) ────────────────────

export type NoteBlockType = 'heading' | 'paragraph' | 'action_item' | 'decision' | 'question' | 'reference';

export interface NoteBlock {
  id: string;
  meetingId: string;
  ordinal: number;
  blockType: NoteBlockType;
  content: string;
  checked: boolean;
  speakerLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── AI Summaries ────────────────────────────────────────────

export interface Summary {
  id: string;
  meetingId: string;
  provider: string;
  model: string;
  style: string;
  bodyMarkdown: string;
  createdAt: string;
}

// ─── Meeting Series (recurring) ──────────────────────────────

export interface MeetingSeries {
  id: string;
  name: string;
  rrule: string | null;
  folderId: string | null;
  meetingTypeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingSeriesEntry {
  meetingId: string;
  seriesId: string;
  ordinal: number;
}

// ─── Templates ───────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Sync queue (outbox pattern) ─────────────────────────────

export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  id: number;
  tableName: string;
  recordId: string;
  action: SyncAction;
  payload: string; // JSON
  createdAt: number;
  retries: number;
  lastError: string | null;
}

// ─── Settings ────────────────────────────────────────────────

export interface Settings {
  apiUrl: string;
  whisperModel: string;
  enableDiarization: boolean;
  autoAcceptJobs: boolean;
  notificationsEnabled: boolean;
}

// ─── Transcription queue (desktop ↔ backend) ─────────────────

export interface PendingJob {
  meetingId: string;
  model: string;
  language: string;
  diarization: boolean;
}

export interface AcceptedJob extends PendingJob {
  audioUrl: string;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  durationMinutes?: number;
  processingTimeMs?: number;
  segments?: string;
  error?: string;
}

// ─── API payloads ────────────────────────────────────────────

export interface MeetingDetailsPayload {
  id: string;
  status: 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';
  createdAt: string;
  transcript?: {
    language: string;
    text: string;
  } | null;
  cost?: {
    whisper?: { minutes: number | null; usd: number | null; brl: number | null } | null;
    total?: { usd: number | null; brl: number | null } | null;
  } | null;
}
