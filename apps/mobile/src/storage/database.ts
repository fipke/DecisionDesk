import * as SQLite from 'expo-sqlite';

import { Meeting, SyncOperation } from '../types';

const dbPromise = SQLite.openDatabaseAsync('decisiondesk.db');

const MEETINGS_COLUMNS = `
  id TEXT PRIMARY KEY NOT NULL,
  remote_id TEXT,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  recording_uri TEXT,
  transcript_text TEXT,
  language TEXT,
  cost_usd REAL,
  cost_brl REAL,
  minutes REAL
`;

export async function initializeDatabase() {
  const db = await dbPromise;
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(`CREATE TABLE IF NOT EXISTS meetings (${MEETINGS_COLUMNS});`);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

export async function listMeetings(): Promise<Meeting[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<Meeting & { remote_id: string | null; recording_uri: string | null }>(
    'SELECT id, remote_id as remoteId, created_at as createdAt, status, recording_uri as recordingUri, transcript_text as transcriptText, language, cost_usd as costUsd, cost_brl as costBrl, minutes FROM meetings ORDER BY datetime(created_at) DESC'
  );
  return rows.map((row) => ({
    ...row,
    remoteId: row.remoteId ?? null,
    recordingUri: row.recordingUri ?? null,
    transcriptText: row.transcriptText ?? null,
    language: row.language ?? null,
    costUsd: row.costUsd ?? null,
    costBrl: row.costBrl ?? null,
    minutes: row.minutes ?? null
  }));
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const db = await dbPromise;
  const row = await db.getFirstAsync<Meeting & { remote_id: string | null; recording_uri: string | null }>(
    'SELECT id, remote_id as remoteId, created_at as createdAt, status, recording_uri as recordingUri, transcript_text as transcriptText, language, cost_usd as costUsd, cost_brl as costBrl, minutes FROM meetings WHERE id = ? LIMIT 1',
    [id]
  );
  if (!row) {
    return null;
  }
  return {
    ...row,
    remoteId: row.remoteId ?? null,
    recordingUri: row.recordingUri ?? null,
    transcriptText: row.transcriptText ?? null,
    language: row.language ?? null,
    costUsd: row.costUsd ?? null,
    costBrl: row.costBrl ?? null,
    minutes: row.minutes ?? null
  };
}

export async function upsertMeeting(meeting: Meeting) {
  const db = await dbPromise;
  await db.runAsync(
    `INSERT INTO meetings (id, remote_id, created_at, status, recording_uri, transcript_text, language, cost_usd, cost_brl, minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       remote_id = excluded.remote_id,
       created_at = excluded.created_at,
       status = excluded.status,
       recording_uri = excluded.recording_uri,
       transcript_text = excluded.transcript_text,
       language = excluded.language,
       cost_usd = excluded.cost_usd,
       cost_brl = excluded.cost_brl,
       minutes = excluded.minutes;
    `,
    [
      meeting.id,
      meeting.remoteId,
      meeting.createdAt,
      meeting.status,
      meeting.recordingUri,
      meeting.transcriptText ?? null,
      meeting.language ?? null,
      meeting.costUsd ?? null,
      meeting.costBrl ?? null,
      meeting.minutes ?? null
    ]
  );
}

export async function patchMeeting(id: string, patch: Partial<Meeting>) {
  const existing = await getMeeting(id);
  if (!existing) {
    return;
  }
  await upsertMeeting({ ...existing, ...patch });
}

export async function enqueueUploadOperation(operation: SyncOperation) {
  const db = await dbPromise;
  await db.runAsync(
    'INSERT INTO sync_queue (meeting_id, payload, created_at) VALUES (?, ?, ?);',
    [operation.meetingId, JSON.stringify(operation.payload), operation.createdAt]
  );
}

export async function listPendingOperations(): Promise<SyncOperation[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<{ id: number; meeting_id: string; payload: string; created_at: number }>(
    'SELECT * FROM sync_queue ORDER BY created_at ASC'
  );
  return rows.map((row) => ({
    id: row.id,
    meetingId: row.meeting_id,
    payload: JSON.parse(row.payload),
    createdAt: row.created_at
  }));
}

export async function removeOperation(id: number) {
  const db = await dbPromise;
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?;', [id]);
}
