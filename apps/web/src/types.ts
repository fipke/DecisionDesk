// ─── API types for DecisionDesk Web ──────────────────────────────────────────

export type MeetingStatus = 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';

export interface Meeting {
  id: string;
  createdAt: string;
  status: MeetingStatus;
  title?: string | null;
  transcriptText?: string | null;
  language?: string | null;
  costUsd?: number | null;
  costBrl?: number | null;
  durationSec?: number | null;
  minutes?: number | null;
  meetingTypeId?: string | null;
  meetingTypeName?: string | null;
}

export interface Person {
  id: string;
  displayName: string;
  fullName?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface SummaryTemplate {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  userPromptTemplate: string;
  outputFormat: string;
  model: string;
  maxTokens: number;
  temperature: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Summary {
  id: string;
  meetingId: string;
  templateId?: string | null;
  templateName?: string | null;
  text: string;
  model?: string | null;
  tokensUsed?: number | null;
  createdAt: string;
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export interface NotesBlock {
  type: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface ActionItem {
  text: string;
  completed: boolean;
  assignee?: string | null;
}

export interface NotesResponse {
  agenda: string | null;
  liveNotes: string | null;
  postNotes: string | null;
  parsedBlocks: NotesBlock[];
  actionItems: ActionItem[];
  decisions: string[];
}

// ─── Meeting Types ──────────────────────────────────────────────────────────

export interface MeetingType {
  id: string;
  name: string;
  description?: string | null;
  requiredTags: Record<string, string>;
  defaultWhisperModel?: string | null;
  summaryTemplateIds: string[];
  extractionConfig: Record<string, unknown>;
  aiProvider?: string | null;
  defaultParticipants: string[];
  icon?: string | null;
  color?: string | null;
  createdAt: string;
}

// ─── Paginated list response from backend ────────────────────────────────────

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
