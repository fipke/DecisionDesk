// ─── Primitives ────────────────────────────────────────────────
export type ID = string;
export type ISODate = string;

// ─── Meetings ──────────────────────────────────────────────────
export type MeetingStatus = 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';

export interface Meeting {
  id: ID;
  title?: string;
  status: MeetingStatus;
  createdAt: ISODate;
  updatedAt?: ISODate;
  durationSec?: number;
  costBrl?: number;
  costUsd?: number;
  folderId?: string;
  meetingTypeId?: string;
  tags?: Record<string, string>;
  transcriptText?: string;
  remoteId?: string;
}

// ─── Transcript ────────────────────────────────────────────────
export interface TranscriptLine {
  speaker?: string;
  startSec?: number;
  endSec?: number;
  text: string;
}

export interface Transcript {
  meetingId: ID;
  lines: TranscriptLine[];
  rawText: string;
  provider: string;
  language: string;
  createdAt: ISODate;
}

// ─── Notes ─────────────────────────────────────────────────────
export interface MeetingNotes {
  agendaMd?: string;
  liveNotesMd?: string;
  postNotesMd?: string;
  updatedAt?: ISODate;
}

export interface ActionItem {
  text: string;
  assignee?: string;
  completed: boolean;
}

export interface Decision {
  text: string;
}

// ─── People ────────────────────────────────────────────────────
export interface Person {
  id: ID;
  displayName: string;
  fullName?: string;
  email?: string;
  notes?: string;
}

export type PersonRole = 'participant' | 'mentioned';

export interface MeetingPerson {
  personId: ID;
  person: Person;
  role: PersonRole;
}

// ─── Organisation ──────────────────────────────────────────────
export interface Folder {
  id: ID;
  name: string;
  path: string;
  parentId?: string;
  children?: Folder[];
}

export interface MeetingType {
  id: ID;
  name: string;
  description?: string;
}

// ─── Summaries ─────────────────────────────────────────────────
export interface Summary {
  id: ID;
  meetingId: ID;
  textMd: string;
  model: string;
  templateId?: string;
  tokensUsed?: number;
  updatedAt: ISODate;
}

export interface SummaryTemplate {
  id: ID;
  name: string;
  isDefault: boolean;
  outputFormat?: string;
}

// ─── Desktop Queue ─────────────────────────────────────────────
export type QueueJobStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface QueueJob {
  id: ID;
  meetingId: ID;
  deviceId?: string;
  status: QueueJobStatus;
  model: string;
  language: string;
  diarization: boolean;
  retryCount?: number;
  errorMessage?: string;
  lockedAt?: ISODate;
  completedAt?: ISODate;
  createdAt: ISODate;
}

// ─── Connectivity ──────────────────────────────────────────────
export interface ConnectivityStatus {
  online: boolean;
  backendReachable: boolean;
}

// ─── Highlight (for search) ────────────────────────────────────
export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

// ─── Meeting Series ────────────────────────────────────────────
export interface MeetingSeries {
  id: ID;
  name: string;
  description?: string;
  recurrenceRule?: string;
}

export interface MeetingSeriesEntry {
  seriesId: ID;
  meetingId: ID;
  sequenceNumber: number;
}

// ─── User Preferences ──────────────────────────────────────────
export interface UserPreferences {
  id: ID;
  userKey: string;
  preferences: Record<string, unknown>;
}
