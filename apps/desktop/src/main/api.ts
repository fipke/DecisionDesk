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
    const response = await this.client.get(audioUrl, {
      responseType: 'stream'
    });

    // Detect extension from Content-Type header
    const contentType = response.headers['content-type'] ?? '';
    const extMap: Record<string, string> = {
      'audio/mp4': '.m4a',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/webm': '.webm',
      'audio/ogg': '.ogg',
    };
    const ext = extMap[contentType] ?? '.m4a';
    const localPath = join(this.downloadDir, `${meetingId}${ext}`);

    const writer = createWriteStream(localPath);
    await pipeline(response.data, writer);

    return localPath;
  }

  async submitResult(meetingId: string, result: TranscriptionResult): Promise<void> {
    await this.client.post(`/api/v1/desktop/queue/${meetingId}/result`, result);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/api/v1/health');
      return true;
    } catch {
      return false;
    }
  }

  // ─── Sync API (outbox push) ──────────────────────────────────

  async syncMeeting(payload: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/meetings/${payload.id}`, payload);
    // Also sync transcript text if present (desktop-local transcription)
    const text = (payload.transcriptText ?? payload.transcript_text) as string | undefined;
    if (text) {
      await this.client.put(`/api/v1/meetings/${payload.id}/transcript`, {
        text,
        language: (payload.language as string) ?? 'pt',
      }).catch((err: any) => console.warn('[Sync] transcript push failed:', err?.message));
    }
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
    await this.client.put(`/api/v1/summary-templates/${payload.id}`, payload);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.client.delete(`/api/v1/summary-templates/${id}`);
  }

  async fetchTemplates(): Promise<any[]> {
    const response = await this.client.get('/api/v1/summary-templates');
    return response.data;
  }

  async generateSummary(meetingId: string, templateId?: string): Promise<any> {
    const response = await this.client.post(`/api/v1/meetings/${meetingId}/summarize`, {
      templateId: templateId ?? null,
    });
    return response.data;
  }

  async fetchSummary(meetingId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/api/v1/meetings/${meetingId}/summary`);
      return response.data;
    } catch {
      return null;
    }
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

  async syncMeetingSpeaker(payload: Record<string, unknown>): Promise<void> {
    await this.client.put(`/api/v1/meetings/${payload.meetingId}/speakers/${payload.id}`, {
      displayName: payload.displayName ?? payload.display_name ?? null,
      personId: payload.personId ?? payload.person_id ?? null,
    });
  }

  async deleteMeetingSpeaker(meetingId: string, speakerId: string): Promise<void> {
    await this.client.delete(`/api/v1/meetings/${meetingId}/speakers/${speakerId}`);
  }

  async syncSegmentsBulk(meetingId: string): Promise<void> {
    // Load segments from local DB and push to backend
    // This is called from the sync service — import here to avoid circular deps
    const { listSegments, listMeetingSpeakers } = await import('./repositories');
    const segments = listSegments(meetingId);
    const speakers = listMeetingSpeakers(meetingId);

    // Push speakers first, then segments
    for (const speaker of speakers) {
      await this.client.put(`/api/v1/meetings/${meetingId}/speakers/${speaker.id}`, {
        displayName: speaker.displayName,
        personId: speaker.personId,
      }).catch(() => { /* speaker may already exist */ });
    }

    await this.client.post(`/api/v1/meetings/${meetingId}/segments`, {
      segments: segments.map(s => ({
        startSec: s.startSec,
        endSec: s.endSec,
        text: s.text,
        speakerLabel: s.speakerLabel,
      })),
    });
  }

  async syncSegmentUpdate(payload: Record<string, unknown>): Promise<void> {
    // Individual segment speaker update — not critical for initial sync
    // The bulk sync will handle it on next full push
  }

  async transcribeMeeting(meetingId: string, options?: { provider?: string; model?: string; enableDiarization?: boolean }): Promise<{ meetingId: string; status: string }> {
    const response = await this.client.post(`/api/v1/meetings/${meetingId}/transcribe`, options ?? {});
    return response.data;
  }

  async resetMeetingStatus(meetingId: string): Promise<any> {
    const response = await this.client.post(`/api/v1/meetings/${meetingId}/reset-status`);
    return response.data;
  }

  async getAudioUrl(meetingId: string): Promise<string> {
    return `${this.client.defaults.baseURL}/api/v1/meetings/${meetingId}/audio`;
  }

  async createTemplateFn(payload: Record<string, unknown>): Promise<any> {
    const response = await this.client.post('/api/v1/summary-templates', payload);
    return response.data;
  }

  async updateTemplateFn(id: string, payload: Record<string, unknown>): Promise<any> {
    const response = await this.client.put(`/api/v1/summary-templates/${id}`, payload);
    return response.data;
  }

  async setDefaultTemplate(id: string): Promise<void> {
    await this.client.post(`/api/v1/summary-templates/${id}/set-default`);
  }

  async createPerson(payload: Record<string, unknown>): Promise<any> {
    const response = await this.client.post('/api/v1/people', payload);
    return response.data;
  }

  async updatePerson(id: string, payload: Record<string, unknown>): Promise<any> {
    const response = await this.client.put(`/api/v1/people/${id}`, payload);
    return response.data;
  }

  // ─── Pull from backend (Phase 2 full sync) ──────────────────

  async fetchMeeting(id: string): Promise<any> {
    const response = await this.client.get(`/api/v1/meetings/${id}`);
    const data = response.data;
    // Flatten nested backend response to match local Meeting shape
    return {
      ...data,
      transcriptText: data.transcript?.text ?? data.transcriptText ?? null,
      language: data.transcript?.language ?? data.language ?? null,
    };
  }

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

  async fetchStats(): Promise<{ totalMeetings: number; totalMinutesRecorded: number; pendingProcessing: number; thisWeekCount: number }> {
    const response = await this.client.get('/api/v1/stats');
    return response.data;
  }

  async fetchCalendar(from: string, to: string): Promise<{ day: string; count: number }[]> {
    const response = await this.client.get('/api/v1/stats/calendar', { params: { from, to } });
    return response.data;
  }
}
