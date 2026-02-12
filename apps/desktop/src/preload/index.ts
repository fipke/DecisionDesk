import { contextBridge, ipcRenderer } from 'electron';

export interface PendingJob {
  meetingId: string;
  model: string;
  language: string;
  diarization: boolean;
}

export interface AcceptedJob extends PendingJob {
  audioUrl: string;
}

export interface Settings {
  apiUrl: string;
  whisperModel: string;
  enableDiarization: boolean;
  autoAcceptJobs: boolean;
  notificationsEnabled: boolean;
}

export interface ElectronAPI {
  settings: {
    get: () => Promise<Settings>;
    set: (key: string, value: unknown) => Promise<Settings>;
  };
  queue: {
    getPending: () => Promise<PendingJob[]>;
    acceptJob: (meetingId: string) => Promise<AcceptedJob>;
    processJob: (meetingId: string) => Promise<void>;
    onJobReceived: (callback: (job: PendingJob) => void) => void;
    onJobCompleted: (callback: (meetingId: string) => void) => void;
    onJobFailed: (callback: (data: { meetingId: string; error: string }) => void) => void;
  };
  whisper: {
    getStatus: () => Promise<{ available: boolean; models: string[] }>;
    transcribe: (audioPath: string, options: {
      model: string;
      language: string;
      enableDiarization: boolean;
    }) => Promise<{
      text: string;
      language: string;
      durationSeconds: number;
      processingTimeMs: number;
    }>;
  };
  api: {
    setUrl: (url: string) => Promise<void>;
  };
}

const electronAPI: ElectronAPI = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value)
  },
  queue: {
    getPending: () => ipcRenderer.invoke('queue:get-pending'),
    acceptJob: (meetingId: string) => ipcRenderer.invoke('queue:accept-job', meetingId),
    processJob: (meetingId: string) => ipcRenderer.invoke('queue:process-job', meetingId),
    onJobReceived: (callback) => ipcRenderer.on('queue:job-received', (_, job) => callback(job)),
    onJobCompleted: (callback) => ipcRenderer.on('queue:job-completed', (_, meetingId) => callback(meetingId)),
    onJobFailed: (callback) => ipcRenderer.on('queue:job-failed', (_, data) => callback(data))
  },
  whisper: {
    getStatus: () => ipcRenderer.invoke('whisper:get-status'),
    transcribe: (audioPath, options) => ipcRenderer.invoke('whisper:transcribe', audioPath, options)
  },
  api: {
    setUrl: (url: string) => ipcRenderer.invoke('api:set-url', url)
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
