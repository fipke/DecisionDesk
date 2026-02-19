import axios from 'axios';
import type { Meeting, Person, PagedResponse, SummaryTemplate, Summary, NotesResponse, MeetingType } from '../types';

/** Base URL is configurable via VITE_API_URL env var; defaults to localhost:8087. */
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Meetings ─────────────────────────────────────────────────────────────────

/** Fetch paginated list of meetings. Returns raw content array for simplicity. */
export async function fetchMeetings(): Promise<Meeting[]> {
  const { data } = await client.get<PagedResponse<Meeting> | Meeting[]>('/meetings', {
    params: { size: 200 },
  });
  // Backend may return a Page object or a plain array depending on version.
  if (Array.isArray(data)) {
    return data;
  }
  return (data as PagedResponse<Meeting>).content;
}

/** Fetch a single meeting by ID. Flattens nested backend response into our flat Meeting shape. */
export async function fetchMeeting(id: string): Promise<Meeting> {
  const { data } = await client.get(`/meetings/${id}`);
  // Backend returns { transcript: { language, text }, ... } — flatten to our Meeting type
  return {
    id: data.id,
    createdAt: data.createdAt,
    status: data.status,
    title: data.title ?? null,
    transcriptText: data.transcript?.text ?? data.transcriptText ?? null,
    language: data.transcript?.language ?? data.language ?? null,
    costUsd: data.cost?.total?.usd ?? data.costUsd ?? null,
    costBrl: data.cost?.total?.brl ?? data.costBrl ?? null,
    durationSec: data.durationSec ?? null,
    minutes: data.minutes ?? null,
    meetingTypeId: data.meetingTypeId ?? null,
    meetingTypeName: data.meetingTypeName ?? null,
  };
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  meetingId: string;
  transcriptLength: number;
}

/** Import an audio file — creates a meeting then uploads the audio. */
export async function importAudioFile(file: File, title?: string): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  const { data } = await client.post<ImportResult>('/import/file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** Import transcript text directly — creates a meeting with the transcript. */
export async function importTranscriptText(text: string, title?: string): Promise<ImportResult> {
  const { data } = await client.post<ImportResult>('/import/text', { text, title });
  return data;
}

// ─── People ───────────────────────────────────────────────────────────────────

/** Fetch all people (participants directory). */
export async function fetchPeople(q?: string): Promise<Person[]> {
  const { data } = await client.get<PagedResponse<Person> | Person[]>('/people', {
    params: { q, size: 200 },
  });
  if (Array.isArray(data)) {
    return data;
  }
  return (data as PagedResponse<Person>).content;
}

/** Create a person. */
export async function createPerson(payload: { displayName: string; fullName?: string; email?: string; notes?: string }): Promise<Person> {
  const { data } = await client.post<Person>('/people', payload);
  return data;
}

/** Update a person by ID. */
export async function updatePerson(id: string, payload: { displayName?: string; fullName?: string; email?: string; notes?: string }): Promise<Person> {
  const { data } = await client.put<Person>(`/people/${id}`, payload);
  return data;
}

/** Delete a person by ID. */
export async function deletePerson(id: string): Promise<void> {
  await client.delete(`/people/${id}`);
}

/** Reset a stuck meeting status back to NEW. */
export async function resetMeetingStatus(id: string): Promise<Meeting> {
  const { data } = await client.post<Meeting>(`/meetings/${id}/reset-status`);
  return data;
}

/** Trigger transcription for a meeting. */
export async function transcribeMeeting(id: string, options?: { provider?: string }): Promise<{ meetingId: string; status: string }> {
  const { data } = await client.post(`/meetings/${id}/transcribe`, options ?? {});
  return data;
}

/** Get audio streaming URL for a meeting. */
export function getAudioUrl(meetingId: string): string {
  return `${BASE_URL}/meetings/${meetingId}/audio`;
}

// ─── Summary Templates ───────────────────────────────────────────────────────

export async function fetchTemplates(): Promise<SummaryTemplate[]> {
  const { data } = await client.get<SummaryTemplate[]>('/summary-templates');
  return data;
}

export async function fetchTemplate(id: string): Promise<SummaryTemplate> {
  const { data } = await client.get<SummaryTemplate>(`/summary-templates/${id}`);
  return data;
}

export async function createTemplate(req: {
  name: string;
  description?: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputFormat?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  isDefault?: boolean;
}): Promise<SummaryTemplate> {
  const { data } = await client.post<SummaryTemplate>('/summary-templates', req);
  return data;
}

export async function updateTemplate(id: string, req: {
  name?: string;
  description?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  outputFormat?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<SummaryTemplate> {
  const { data } = await client.put<SummaryTemplate>(`/summary-templates/${id}`, req);
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await client.delete(`/summary-templates/${id}`);
}

export async function setDefaultTemplate(id: string): Promise<void> {
  await client.post(`/summary-templates/${id}/set-default`);
}

// ─── Summaries ───────────────────────────────────────────────────────────────

export async function generateSummary(meetingId: string, templateId?: string): Promise<Summary> {
  const { data } = await client.post<Summary>(`/meetings/${meetingId}/summarize`, {
    templateId: templateId ?? null,
  });
  return data;
}

export async function fetchSummary(meetingId: string): Promise<Summary | null> {
  try {
    const { data } = await client.get<Summary>(`/meetings/${meetingId}/summary`);
    return data;
  } catch {
    return null;
  }
}

/** Fetch all summaries for a meeting (multi-summary). */
export async function fetchSummaries(meetingId: string): Promise<Summary[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await client.get<any[]>(`/meetings/${meetingId}/summaries`);
    // Backend SummarizeResponse uses textMd; normalize to text
    return data.map((s) => ({
      ...s,
      text: s.text ?? s.textMd ?? '',
    }));
  } catch {
    return [];
  }
}

/** Generate all summaries from meeting type templates. */
export async function generateAllSummaries(meetingId: string): Promise<Summary[]> {
  const { data } = await client.post<Summary[]>(`/meetings/${meetingId}/summarize-all`);
  return data;
}

/** Delete a specific summary. */
export async function deleteSummary(meetingId: string, summaryId: string): Promise<void> {
  await client.delete(`/meetings/${meetingId}/summaries/${summaryId}`);
}

// ─── Notes ──────────────────────────────────────────────────────────────────

/** Fetch meeting notes (agenda, live, post + parsed blocks + action items + decisions). */
export async function fetchNotes(meetingId: string): Promise<NotesResponse> {
  const { data } = await client.get<NotesResponse>(`/meetings/${meetingId}/notes`);
  return data;
}

/** Update the agenda section of notes. */
export async function updateAgenda(meetingId: string, content: string): Promise<void> {
  await client.patch(`/meetings/${meetingId}/notes/agenda`, { content });
}

/** Update live notes. */
export async function updateLiveNotes(meetingId: string, content: string): Promise<void> {
  await client.patch(`/meetings/${meetingId}/notes/live`, { content });
}

/** Update post-meeting notes. */
export async function updatePostNotes(meetingId: string, content: string): Promise<void> {
  await client.patch(`/meetings/${meetingId}/notes/post`, { content });
}

// ─── Meeting Types ──────────────────────────────────────────────────────────

export async function fetchMeetingTypes(): Promise<MeetingType[]> {
  const { data } = await client.get<MeetingType[]>('/meeting-types');
  return data;
}

export async function fetchMeetingType(id: string): Promise<MeetingType> {
  const { data } = await client.get<MeetingType>(`/meeting-types/${id}`);
  return data;
}

export async function createMeetingType(req: {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  summaryTemplateIds?: string[];
  extractionConfig?: Record<string, unknown>;
  aiProvider?: string;
}): Promise<MeetingType> {
  const { data } = await client.post<MeetingType>('/meeting-types', req);
  return data;
}

export async function updateMeetingType(id: string, req: {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  summaryTemplateIds?: string[];
  extractionConfig?: Record<string, unknown>;
  aiProvider?: string;
}): Promise<MeetingType> {
  const { data } = await client.put<MeetingType>(`/meeting-types/${id}`, req);
  return data;
}

export async function deleteMeetingType(id: string): Promise<void> {
  await client.delete(`/meeting-types/${id}`);
}

// ─── AI Settings ─────────────────────────────────────────────────────────────

export interface AiTaskConfig {
  provider: string;
  model: string;
}

export interface AiSettingsConfig {
  summarization: AiTaskConfig;
  extraction: AiTaskConfig;
  chat: AiTaskConfig;
  openaiEnabled: boolean;
}

export interface AiSettingsResponse {
  config: AiSettingsConfig;
  ollamaAvailable: boolean;
}

export interface OllamaStatus {
  running: boolean;
  models: { name: string; sizeBytes: number; parameterSize: string }[];
}

export async function fetchAiSettings(): Promise<AiSettingsResponse> {
  const { data } = await client.get<AiSettingsResponse>('/settings/ai');
  return data;
}

export async function updateAiSettings(config: AiSettingsConfig): Promise<AiSettingsResponse> {
  const { data } = await client.put<AiSettingsResponse>('/settings/ai', config);
  return data;
}

export async function fetchOllamaStatus(): Promise<OllamaStatus> {
  try {
    const { data } = await client.get<OllamaStatus>('/ollama/status');
    return data;
  } catch {
    return { running: false, models: [] };
  }
}

export async function loadOllamaModel(model: string): Promise<void> {
  await client.post('/ollama/load', { model });
}

export async function unloadOllamaModel(model: string): Promise<void> {
  await client.post('/ollama/unload', { model });
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalMeetings: number;
  totalMinutesRecorded: number;
  pendingProcessing: number;
  thisWeekCount: number;
}

export interface CalendarDay {
  day: string;
  count: number;
}

export async function fetchStats(): Promise<DashboardStats> {
  const { data } = await client.get<DashboardStats>('/stats');
  return data;
}

export async function fetchCalendar(from: string, to: string): Promise<CalendarDay[]> {
  const { data } = await client.get<CalendarDay[]>('/stats/calendar', { params: { from, to } });
  return data;
}
