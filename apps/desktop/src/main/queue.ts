import { ApiService, PendingJob, AcceptedJob } from './api';
import { WhisperService, TranscribeResult } from './whisper';
import { unlinkSync, existsSync } from 'fs';

export interface QueueCallbacks {
  onJobReceived: (job: PendingJob) => void;
  onJobCompleted: (meetingId: string) => void;
  onJobFailed: (meetingId: string, error: string) => void;
}

interface QueuedJob {
  job: AcceptedJob;
  localAudioPath?: string;
  status: 'pending' | 'accepted' | 'downloading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export class QueueService {
  private api: ApiService;
  private whisper: WhisperService;
  private callbacks: QueueCallbacks;
  private jobs: Map<string, QueuedJob> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  constructor(api: ApiService, whisper: WhisperService, callbacks: QueueCallbacks) {
    this.api = api;
    this.whisper = whisper;
    this.callbacks = callbacks;
  }

  startPolling(intervalMs: number): void {
    this.stopPolling();
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
    this.poll(); // Initial poll
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const pendingJobs = await this.api.getPendingJobs();
      
      for (const job of pendingJobs) {
        if (!this.jobs.has(job.meetingId)) {
          this.callbacks.onJobReceived(job);
        }
      }
    } catch (err) {
      console.error('Failed to poll for jobs:', err);
    }
  }

  getPendingJobs(): PendingJob[] {
    return Array.from(this.jobs.values())
      .filter(j => j.status === 'pending' || j.status === 'accepted')
      .map(j => ({
        meetingId: j.job.meetingId,
        model: j.job.model,
        language: j.job.language,
        diarization: j.job.diarization
      }));
  }

  getJobStatus(meetingId: string): QueuedJob | undefined {
    return this.jobs.get(meetingId);
  }

  async acceptJob(meetingId: string): Promise<AcceptedJob> {
    const acceptedJob = await this.api.acceptJob(meetingId);
    
    this.jobs.set(meetingId, {
      job: acceptedJob,
      status: 'accepted'
    });

    return acceptedJob;
  }

  async processJob(meetingId: string): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Another job is being processed');
    }

    const queuedJob = this.jobs.get(meetingId);
    if (!queuedJob) {
      throw new Error('Job not found');
    }

    this.isProcessing = true;

    try {
      // Download audio
      queuedJob.status = 'downloading';
      const localPath = await this.api.downloadAudio(meetingId, queuedJob.job.audioUrl);
      queuedJob.localAudioPath = localPath;

      // Process with whisper
      queuedJob.status = 'processing';
      const result = await this.whisper.transcribe(localPath, {
        model: queuedJob.job.model,
        language: queuedJob.job.language,
        enableDiarization: queuedJob.job.diarization
      });

      // Submit result
      await this.api.submitResult(meetingId, {
        text: result.text,
        language: result.language,
        durationMinutes: result.durationSeconds / 60,
        processingTimeMs: result.processingTimeMs,
        segments: result.segments ? JSON.stringify(result.segments) : undefined
      });

      queuedJob.status = 'completed';
      this.callbacks.onJobCompleted(meetingId);

      // Cleanup
      this.cleanup(meetingId);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      queuedJob.status = 'failed';
      queuedJob.error = errorMessage;

      try {
        await this.api.submitResult(meetingId, { 
          text: '', 
          error: errorMessage 
        });
      } catch {
        // Ignore error when submitting failure
      }

      this.callbacks.onJobFailed(meetingId, errorMessage);
      this.cleanup(meetingId);
    } finally {
      this.isProcessing = false;
    }
  }

  private cleanup(meetingId: string): void {
    const job = this.jobs.get(meetingId);
    if (job?.localAudioPath && existsSync(job.localAudioPath)) {
      try {
        unlinkSync(job.localAudioPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.jobs.delete(meetingId);
  }
}
