export type MeetingStatus = 'PENDING_SYNC' | 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';

export interface Meeting {
  id: string; // local identifier
  remoteId: string | null;
  createdAt: string;
  status: MeetingStatus;
  recordingUri: string | null;
  transcriptText?: string | null;
  language?: string | null;
  costUsd?: number | null;
  costBrl?: number | null;
  minutes?: number | null;
}

export interface WhisperCost {
  minutes: number | null;
  usd: number | null;
  brl: number | null;
}

export interface MeetingDetailsPayload {
  id: string;
  status: 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';
  createdAt: string;
  transcript?: {
    language: string;
    text: string;
  } | null;
  cost?: {
    whisper?: {
      minutes: number | null;
      usd: number | null;
      brl: number | null;
    } | null;
    total?: {
      usd: number | null;
      brl: number | null;
    } | null;
  } | null;
}

export interface SyncOperation {
  id?: number;
  meetingId: string;
  payload: {
    recordingUri: string;
  };
  createdAt: number;
}
