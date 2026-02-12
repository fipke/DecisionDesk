import axios from 'axios';
import Constants from 'expo-constants';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';

import { MeetingDetailsPayload, TranscriptionProvider, WhisperModel } from '../types';

export interface TranscribeRequestOptions {
  provider: TranscriptionProvider;
  model?: WhisperModel;
  enableDiarization?: boolean;
}

const extra = Constants?.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
const baseURL = (extra?.apiBaseUrl ?? 'http://localhost:8087/api/v1').replace(/\/$/, '');

export const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    Accept: 'application/json'
  }
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
  const uploadUrl = `${baseURL}/meetings/${meetingId}/audio`;
  const file = new File(fileUri);
  const formData = new FormData();
  formData.append('file', file as any);

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

export async function fetchMeetingDetails(meetingId: string): Promise<MeetingDetailsPayload> {
  const { data } = await api.get<MeetingDetailsPayload>(`/meetings/${meetingId}`);
  return data;
}
