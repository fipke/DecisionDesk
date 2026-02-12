export type MeetingStatus = 'PENDING_SYNC' | 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';

/**
 * Transcription provider options
 * - desktop_local: whisper.cpp running on Mac (default - FREE, best privacy)
 * - server_local: whisper.cpp running on VPS/server (FREE, lower latency)
 * - remote_openai: OpenAI Whisper API (cloud, paid)
 */
export type TranscriptionProvider = 'desktop_local' | 'server_local' | 'remote_openai';

/**
 * Whisper model options for local transcription
 */
export type WhisperModel = 'large-v3' | 'medium' | 'small' | 'base' | 'tiny';

export interface TranscriptionSettings {
  defaultProvider: TranscriptionProvider;
  defaultModel: WhisperModel;
  enableDiarization: boolean;
}

/**
 * Folder for organizing meetings (PR07)
 */
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

/**
 * Meeting type for categorizing meetings (PR07)
 */
export interface MeetingType {
  id: string;
  name: string;
  description: string | null;
  requiredTags: Record<string, string>;
  defaultWhisperModel: string | null;
  createdAt: string;
  synced: boolean;
}

/**
 * Person who can be a participant or mentioned in meetings (PR08)
 */
export interface Person {
  id: string;
  displayName: string;  // short name for @mentions
  fullName: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

/**
 * Role of a person in a meeting (PR08)
 */
export type PersonRole = 'participant' | 'mentioned';

/**
 * Association between a meeting and a person (PR08)
 */
export interface MeetingPerson {
  meetingId: string;
  personId: string;
  role: PersonRole;
  createdAt: string;
}

export interface Meeting {
  id: string; // local identifier
  remoteId: string | null;
  createdAt: string;
  status: MeetingStatus;
  recordingUri: string | null;
  transcriptText?: string | null;
  language?: string | null;
  costUsd?: number | null;
  costBrl?: number | null;
  minutes?: number | null;
  // PR07: Organization fields
  folderId?: string | null;
  meetingTypeId?: string | null;
  tags?: Record<string, string>;
  title?: string | null;
  updatedAt?: string | null;
}

export interface WhisperCost {
  minutes: number | null;
  usd: number | null;
  brl: number | null;
}

export interface MeetingDetailsPayload {
  id: string;
  status: 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';
  createdAt: string;
  transcript?: {
    language: string;
    text: string;
  } | null;
  cost?: {
    whisper?: {
      minutes: number | null;
      usd: number | null;
      brl: number | null;
    } | null;
    total?: {
      usd: number | null;
      brl: number | null;
    } | null;
  } | null;
}

export interface SyncOperation {
  id?: number;
  meetingId: string;
  payload: {
    recordingUri: string;
  };
  createdAt: number;
}
