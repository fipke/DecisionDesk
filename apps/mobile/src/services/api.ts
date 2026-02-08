import axios from 'axios';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';

import { MeetingDetailsPayload } from '../types';

const extra = Constants?.expoConfig?.extra as { apiBaseUrl?: string } | undefined;
const baseURL = (extra?.apiBaseUrl ?? 'http://localhost:8080/api/v1').replace(/\/$/, '');

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
  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'audio/m4a',
    headers: {
      Accept: 'application/json'
    }
  });

  return JSON.parse(result.body) as UploadAudioResponse;
}

export async function triggerTranscription(meetingId: string): Promise<TranscribeResponse> {
  const { data } = await api.post<TranscribeResponse>(`/meetings/${meetingId}/transcribe`);
  return data;
}

export async function fetchMeetingDetails(meetingId: string): Promise<MeetingDetailsPayload> {
  const { data } = await api.get<MeetingDetailsPayload>(`/meetings/${meetingId}`);
  return data;
}
