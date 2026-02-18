import axios, { AxiosInstance } from 'axios';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { pipeline } from 'stream/promises';

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

export class ApiService {
  private client: AxiosInstance;
  private downloadDir: string;

  constructor(baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000
    });
    
    this.downloadDir = join(app.getPath('temp'), 'decisiondesk-audio');
    if (!existsSync(this.downloadDir)) {
      mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  setBaseUrl(url: string): void {
    this.client.defaults.baseURL = url;
  }

  async getPendingJobs(): Promise<PendingJob[]> {
    const response = await this.client.get('/api/v1/desktop/queue');
    return response.data;
  }

  async acceptJob(meetingId: string): Promise<AcceptedJob> {
    const response = await this.client.post(`/api/v1/desktop/queue/${meetingId}/accept`);
    return response.data;
  }

  async downloadAudio(meetingId: string, audioUrl: string): Promise<string> {
    const localPath = join(this.downloadDir, `${meetingId}.audio`);
    
    const response = await this.client.get(audioUrl, {
      responseType: 'stream'
    });

    const writer = createWriteStream(localPath);
    await pipeline(response.data, writer);

    return localPath;
  }

  async submitResult(meetingId: string, result: TranscriptionResult): Promise<void> {
    await this.client.post(`/api/v1/desktop/queue/${meetingId}/result`, result);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }

  // ─── Sync API (outbox push) ──────────────────────────────────

  async syncMeeting(payload: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/meetings/${payload.id}`, payload);
  }

  async deleteMeeting(id: string): Promise<void> {
    await this.client.delete(`/api/v1/meetings/${id}`);
  }

  async syncFolder(payload: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/folders/${payload.id}`, payload);
  }

  async deleteFolder(id: string): Promise<void> {
    await this.client.delete(`/api/v1/folders/${id}`);
  }

  async syncPerson(payload: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/people/${payload.id}`, payload);
  }

  async deletePerson(id: string): Promise<void> {
    await this.client.delete(`/api/v1/people/${id}`);
  }

  async syncNoteBlock(payload: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/meetings/${payload.meetingId}/notes/${payload.id}`, payload);
  }

  async deleteNoteBlock(id: string): Promise<void> {
    await this.client.delete(`/api/v1/notes/${id}`);
  }

  async syncSummary(payload: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/meetings/${payload.meetingId}/summaries/${payload.id}`, payload);
  }

  async syncTemplate(payload: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/templates/${payload.id}`, payload);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.client.delete(`/api/v1/templates/${id}`);
  }

  async syncMeetingPerson(payload: Record<string, unknown>): Promise<void> {
    await this.client.post(`/api/v1/meetings/${payload.meetingId}/people`, payload);
  }

  async deleteMeetingPerson(meetingId: string, personId: string, role: string): Promise<void> {
    await this.client.delete(`/api/v1/meetings/${meetingId}/people/${personId}/${role}`);
  }

  async syncMeetingSeries(payload: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/series/${payload.id}`, payload);
  }

  // ─── Pull from backend (Phase 2 full sync) ──────────────────

  async fetchAllMeetings(): Promise<any[]> {
    const response = await this.client.get('/api/v1/meetings');
    return response.data;
  }

  async fetchAllFolders(): Promise<any[]> {
    const response = await this.client.get('/api/v1/folders');
    return response.data;
  }

  async fetchAllPeople(): Promise<any[]> {
    const response = await this.client.get('/api/v1/people');
    return response.data;
  }
}
