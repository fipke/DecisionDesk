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
  minutes?: number | null;
}

export interface Person {
  id: string;
  displayName: string;
  fullName?: string | null;
  email?: string | null;
}

// ─── Paginated list response from backend ────────────────────────────────────

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
