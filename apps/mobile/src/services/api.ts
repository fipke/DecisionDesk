import axios from 'axios';
import Constants from 'expo-constants';
import { fetch } from 'expo/fetch';

import { MeetingDetailsPayload, TranscriptionProvider, WhisperModel } from '../types';

export interface TranscribeRequestOptions {
  provider: TranscriptionProvider;
  model?: WhisperModel;
  enableDiarization?: boolean;
}

// ─── Dynamic API URL detection ─────────────────────────────────────────

/**
 * Tries multiple backend URLs in order of priority:
 * 1. localhost (works on iOS Simulator)
 * 2. <hostname>.local (works on physical devices via Bonjour/mDNS)
 * 3. Current IP (last resort)
 */
async function detectBackendUrl(): Promise<string> {
  const extra = Constants?.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
  const envUrl = extra?.apiBaseUrl;
  
  // If env var is set and not localhost, use it directly
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl;
  }

  const port = '8087';
  const candidates = [
    `http://localhost:${port}/api/v1`,                    // iOS Simulator
    `http://Djeimis-MacBook-Pro-3.local:${port}/api/v1`,  // Physical device (Bonjour)
  ];

  // Try each URL with a quick health check
  for (const url of candidates) {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2s timeout per attempt
      });
      if (response.ok) {
        console.log(`[API] ✓ Backend detectado em: ${url}`);
        return url;
      }
    } catch (error) {
      console.log(`[API] ✗ Backend não encontrado em: ${url}`);
    }
  }

  // Fallback to localhost (let axios handle the error)
  console.warn('[API] ⚠️  Usando localhost como fallback');
  return `http://localhost:${port}/api/v1`;
}

// Initialize with a placeholder, will be updated on first request
let baseURL = 'http://localhost:8087/api/v1';
let baseURLPromise: Promise<string> | null = null;

const getBaseUrl = async (): Promise<string> => {
  if (!baseURLPromise) {
    baseURLPromise = detectBackendUrl().then(url => {
      baseURL = url;
      api.defaults.baseURL = url;
      return url;
    });
  }
  return baseURLPromise;
};

export const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    Accept: 'application/json'
  }
});

// Auto-detect backend URL before first request
api.interceptors.request.use(async (config) => {
  await getBaseUrl();
  return config;
});

export interface CreateMeetingResponse {
  id: string;
  createdAt: string;
}

export interface UploadAudioResponse {
  meetingId: string;
  assetId: string;
  status: 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';
}

export interface TranscribeResponse {
  meetingId: string;
  status: 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';
}

export async function createMeeting(): Promise<CreateMeetingResponse> {
  const { data } = await api.post<CreateMeetingResponse>('/meetings');
  return data;
}

export async function uploadAudio(meetingId: string, fileUri: string): Promise<UploadAudioResponse> {
  const currentBaseUrl = await getBaseUrl();
  const uploadUrl = `${currentBaseUrl}/meetings/${meetingId}/audio`;
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: 'recording.m4a',
    type: 'audio/x-m4a',
  } as any);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  return await response.json() as UploadAudioResponse;
}

export async function triggerTranscription(
  meetingId: string,
  options: TranscribeRequestOptions
): Promise<TranscribeResponse> {
  const { data } = await api.post<TranscribeResponse>(`/meetings/${meetingId}/transcribe`, {
    provider: options.provider,
    model: options.model,
    enableDiarization: options.enableDiarization
  });
  return data;
}

export interface ListMeetingItem {
  id: string;
  status: string;
  title: string | null;
  createdAt: string;
  updatedAt: string | null;
  durationSec: number | null;
  minutes: number | null;
  meetingTypeName: string | null;
}

export async function fetchAllMeetings(): Promise<ListMeetingItem[]> {
  const { data } = await api.get<ListMeetingItem[] | { content: ListMeetingItem[] }>('/meetings', {
    params: { size: 200 },
  });
  if (Array.isArray(data)) return data;
  return (data as { content: ListMeetingItem[] }).content;
}

export interface ImportResult {
  meetingId: string;
  transcriptLength: number;
}

export async function importTranscriptText(text: string, title?: string): Promise<ImportResult> {
  const { data } = await api.post<ImportResult>('/import/text', { text, title });
  return data;
}

export async function importAudioFromUri(fileUri: string, title?: string): Promise<ImportResult> {
  const currentBaseUrl = await getBaseUrl();
  const uploadUrl = `${currentBaseUrl}/import/file`;
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: 'import.m4a',
    type: 'audio/x-m4a',
  } as any);
  if (title) formData.append('title', title);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Import failed with status ${response.status}`);
  return await response.json() as ImportResult;
}

export async function fetchMeetingDetails(meetingId: string): Promise<MeetingDetailsPayload> {
  const { data } = await api.get<MeetingDetailsPayload>(`/meetings/${meetingId}`);
  return data;
}

// ─── Summary templates & generation ─────────────────────────────────

export interface SummaryTemplate {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt?: string;
  userPromptTemplate?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  outputFormat?: string;
  isDefault: boolean;
}

export interface Summary {
  id: string;
  text: string;
  model?: string;
  tokensUsed?: number;
}

export async function fetchTemplates(): Promise<SummaryTemplate[]> {
  const { data } = await api.get<SummaryTemplate[]>('/summary-templates');
  return data;
}

export async function createTemplate(payload: Record<string, unknown>): Promise<SummaryTemplate> {
  const { data } = await api.post<SummaryTemplate>('/summary-templates', payload);
  return data;
}

export async function updateTemplate(id: string, payload: Record<string, unknown>): Promise<SummaryTemplate> {
  const { data } = await api.put<SummaryTemplate>(`/summary-templates/${id}`, payload);
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/summary-templates/${id}`);
}

export async function setDefaultTemplate(id: string): Promise<void> {
  await api.post(`/summary-templates/${id}/set-default`);
}

export async function generateSummary(
  meetingId: string,
  templateId?: string
): Promise<Summary> {
  const { data } = await api.post<Summary>(`/meetings/${meetingId}/summarize`, {
    templateId: templateId ?? null,
  });
  return data;
}

export async function fetchSummary(
  meetingId: string
): Promise<{ id: string; text: string } | null> {
  try {
    const { data } = await api.get<{ id: string; text: string }>(`/meetings/${meetingId}/summary`);
    return data;
  } catch {
    return null;
  }
}

export async function getAudioUrl(meetingId: string): Promise<string> {
  const url = await getBaseUrl();
  return `${url}/meetings/${meetingId}/audio`;
}

// ─── AI / Summary provider settings ─────────────────────────────────

export async function fetchAiSettings(): Promise<any> {
  const response = await api.get('/settings/ai');
  return response.data;
}

export async function updateAiSettings(config: any): Promise<any> {
  const response = await api.put('/settings/ai', config);
  return response.data;
}
