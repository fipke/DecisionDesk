import * as SQLite from 'expo-sqlite';

import { Folder, Meeting, MeetingType, Person, MeetingPerson, SyncOperation } from '../types';

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
  minutes REAL,
  folder_id TEXT,
  meeting_type_id TEXT,
  tags TEXT,
  title TEXT,
  updated_at TEXT
`;

const FOLDERS_COLUMNS = `
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  parent_id TEXT,
  default_tags TEXT,
  default_whisper_model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced INTEGER DEFAULT 0
`;

const MEETING_TYPES_COLUMNS = `
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  required_tags TEXT,
  default_whisper_model TEXT,
  created_at TEXT NOT NULL,
  synced INTEGER DEFAULT 0
`;

const PEOPLE_COLUMNS = `
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced INTEGER DEFAULT 0
`;

const MEETING_PEOPLE_COLUMNS = `
  meeting_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (meeting_id, person_id, role)
`;

export async function initializeDatabase() {
  const db = await dbPromise;
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(`CREATE TABLE IF NOT EXISTS meetings (${MEETINGS_COLUMNS});`);
  await db.execAsync(`CREATE TABLE IF NOT EXISTS folders (${FOLDERS_COLUMNS});`);
  await db.execAsync(`CREATE TABLE IF NOT EXISTS meeting_types (${MEETING_TYPES_COLUMNS});`);
  await db.execAsync(`CREATE TABLE IF NOT EXISTS people (${PEOPLE_COLUMNS});`);
  await db.execAsync(`CREATE TABLE IF NOT EXISTS meeting_people (${MEETING_PEOPLE_COLUMNS});`);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  
  // Schema migrations: add columns that may be missing from databases created before PR07/PR08.
  // SQLite does not support ADD COLUMN IF NOT EXISTS, so we catch errors for already-existing columns.
  const meetingColumnMigrations = [
    'ALTER TABLE meetings ADD COLUMN folder_id TEXT',
    'ALTER TABLE meetings ADD COLUMN meeting_type_id TEXT',
    'ALTER TABLE meetings ADD COLUMN tags TEXT',
    'ALTER TABLE meetings ADD COLUMN title TEXT',
    'ALTER TABLE meetings ADD COLUMN updated_at TEXT',
  ];
  for (const sql of meetingColumnMigrations) {
    try {
      await db.execAsync(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Insert default root folder if not exists
  await db.runAsync(`
    INSERT OR IGNORE INTO folders (id, name, path, parent_id, default_tags, created_at, updated_at, synced)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Raiz', '/', NULL, '{}', datetime('now'), datetime('now'), 1)
  `);
}

export async function listMeetings(): Promise<Meeting[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<Meeting & { remote_id: string | null; recording_uri: string | null; folder_id: string | null; meeting_type_id: string | null }>(
    `SELECT id, remote_id as remoteId, created_at as createdAt, status, recording_uri as recordingUri, 
     transcript_text as transcriptText, language, cost_usd as costUsd, cost_brl as costBrl, minutes,
     folder_id as folderId, meeting_type_id as meetingTypeId, tags, title, updated_at as updatedAt
     FROM meetings ORDER BY datetime(created_at) DESC`
  );
  return rows.map((row) => ({
    ...row,
    remoteId: row.remoteId ?? null,
    recordingUri: row.recordingUri ?? null,
    transcriptText: row.transcriptText ?? null,
    language: row.language ?? null,
    costUsd: row.costUsd ?? null,
    costBrl: row.costBrl ?? null,
    minutes: row.minutes ?? null,
    folderId: row.folderId ?? null,
    meetingTypeId: row.meetingTypeId ?? null,
    tags: row.tags ? JSON.parse(row.tags as unknown as string) : {},
    title: row.title ?? null,
    updatedAt: row.updatedAt ?? null
  }));
}

export async function listMeetingsByFolder(folderId: string): Promise<Meeting[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<Meeting & { remote_id: string | null; recording_uri: string | null; folder_id: string | null; meeting_type_id: string | null }>(
    `SELECT id, remote_id as remoteId, created_at as createdAt, status, recording_uri as recordingUri, 
     transcript_text as transcriptText, language, cost_usd as costUsd, cost_brl as costBrl, minutes,
     folder_id as folderId, meeting_type_id as meetingTypeId, tags, title, updated_at as updatedAt
     FROM meetings WHERE folder_id = ? ORDER BY datetime(created_at) DESC`,
    [folderId]
  );
  return rows.map((row) => ({
    ...row,
    remoteId: row.remoteId ?? null,
    recordingUri: row.recordingUri ?? null,
    transcriptText: row.transcriptText ?? null,
    language: row.language ?? null,
    costUsd: row.costUsd ?? null,
    costBrl: row.costBrl ?? null,
    minutes: row.minutes ?? null,
    folderId: row.folderId ?? null,
    meetingTypeId: row.meetingTypeId ?? null,
    tags: row.tags ? JSON.parse(row.tags as unknown as string) : {},
    title: row.title ?? null,
    updatedAt: row.updatedAt ?? null
  }));
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const db = await dbPromise;
  const row = await db.getFirstAsync<Meeting & { remote_id: string | null; recording_uri: string | null; folder_id: string | null; meeting_type_id: string | null }>(
    `SELECT id, remote_id as remoteId, created_at as createdAt, status, recording_uri as recordingUri, 
     transcript_text as transcriptText, language, cost_usd as costUsd, cost_brl as costBrl, minutes,
     folder_id as folderId, meeting_type_id as meetingTypeId, tags, title, updated_at as updatedAt
     FROM meetings WHERE id = ? LIMIT 1`,
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
    minutes: row.minutes ?? null,
    folderId: row.folderId ?? null,
    meetingTypeId: row.meetingTypeId ?? null,
    tags: row.tags ? JSON.parse(row.tags as unknown as string) : {},
    title: row.title ?? null,
    updatedAt: row.updatedAt ?? null
  };
}

export async function upsertMeeting(meeting: Meeting) {
  const db = await dbPromise;
  await db.runAsync(
    `INSERT INTO meetings (id, remote_id, created_at, status, recording_uri, transcript_text, language, cost_usd, cost_brl, minutes, folder_id, meeting_type_id, tags, title, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       remote_id = excluded.remote_id,
       created_at = excluded.created_at,
       status = excluded.status,
       recording_uri = excluded.recording_uri,
       transcript_text = excluded.transcript_text,
       language = excluded.language,
       cost_usd = excluded.cost_usd,
       cost_brl = excluded.cost_brl,
       minutes = excluded.minutes,
       folder_id = excluded.folder_id,
       meeting_type_id = excluded.meeting_type_id,
       tags = excluded.tags,
       title = excluded.title,
       updated_at = excluded.updated_at;
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
      meeting.minutes ?? null,
      meeting.folderId ?? null,
      meeting.meetingTypeId ?? null,
      meeting.tags ? JSON.stringify(meeting.tags) : '{}',
      meeting.title ?? null,
      meeting.updatedAt ?? new Date().toISOString()
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

// ============ Folder Operations ============

export async function listFolders(): Promise<Folder[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    path: string;
    parent_id: string | null;
    default_tags: string;
    default_whisper_model: string | null;
    created_at: string;
    updated_at: string;
    synced: number;
  }>('SELECT * FROM folders ORDER BY path');
  
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    path: row.path,
    parentId: row.parent_id,
    defaultTags: row.default_tags ? JSON.parse(row.default_tags) : {},
    defaultWhisperModel: row.default_whisper_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1
  }));
}

export async function getFolder(id: string): Promise<Folder | null> {
  const db = await dbPromise;
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    path: string;
    parent_id: string | null;
    default_tags: string;
    default_whisper_model: string | null;
    created_at: string;
    updated_at: string;
    synced: number;
  }>('SELECT * FROM folders WHERE id = ? LIMIT 1', [id]);
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    parentId: row.parent_id,
    defaultTags: row.default_tags ? JSON.parse(row.default_tags) : {},
    defaultWhisperModel: row.default_whisper_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1
  };
}

export async function upsertFolder(folder: Folder) {
  const db = await dbPromise;
  await db.runAsync(
    `INSERT INTO folders (id, name, path, parent_id, default_tags, default_whisper_model, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       path = excluded.path,
       parent_id = excluded.parent_id,
       default_tags = excluded.default_tags,
       default_whisper_model = excluded.default_whisper_model,
       updated_at = excluded.updated_at,
       synced = excluded.synced;
    `,
    [
      folder.id,
      folder.name,
      folder.path,
      folder.parentId ?? null,
      JSON.stringify(folder.defaultTags ?? {}),
      folder.defaultWhisperModel ?? null,
      folder.createdAt,
      folder.updatedAt,
      folder.synced ? 1 : 0
    ]
  );
}

export async function deleteFolder(id: string) {
  const db = await dbPromise;
  await db.runAsync('DELETE FROM folders WHERE id = ?;', [id]);
}

// ============ Meeting Type Operations ============

export async function listMeetingTypes(): Promise<MeetingType[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    description: string | null;
    required_tags: string;
    default_whisper_model: string | null;
    created_at: string;
    synced: number;
  }>('SELECT * FROM meeting_types ORDER BY name');
  
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    requiredTags: row.required_tags ? JSON.parse(row.required_tags) : {},
    defaultWhisperModel: row.default_whisper_model,
    createdAt: row.created_at,
    synced: row.synced === 1
  }));
}

export async function getMeetingType(id: string): Promise<MeetingType | null> {
  const db = await dbPromise;
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    description: string | null;
    required_tags: string;
    default_whisper_model: string | null;
    created_at: string;
    synced: number;
  }>('SELECT * FROM meeting_types WHERE id = ? LIMIT 1', [id]);
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    requiredTags: row.required_tags ? JSON.parse(row.required_tags) : {},
    defaultWhisperModel: row.default_whisper_model,
    createdAt: row.created_at,
    synced: row.synced === 1
  };
}

export async function upsertMeetingType(meetingType: MeetingType) {
  const db = await dbPromise;
  await db.runAsync(
    `INSERT INTO meeting_types (id, name, description, required_tags, default_whisper_model, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       required_tags = excluded.required_tags,
       default_whisper_model = excluded.default_whisper_model,
       synced = excluded.synced;
    `,
    [
      meetingType.id,
      meetingType.name,
      meetingType.description ?? null,
      JSON.stringify(meetingType.requiredTags ?? {}),
      meetingType.defaultWhisperModel ?? null,
      meetingType.createdAt,
      meetingType.synced ? 1 : 0
    ]
  );
}

export async function deleteMeetingType(id: string) {
  const db = await dbPromise;
  await db.runAsync('DELETE FROM meeting_types WHERE id = ?;', [id]);
}

// ========== People ==========

export async function listPeople(): Promise<Person[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<{
    id: string;
    display_name: string;
    full_name: string | null;
    email: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    synced: number;
  }>('SELECT * FROM people ORDER BY display_name');
  
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    fullName: row.full_name,
    email: row.email,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1
  }));
}

export async function searchPeople(query: string): Promise<Person[]> {
  const db = await dbPromise;
  const pattern = `${query.toLowerCase()}%`;
  const rows = await db.getAllAsync<{
    id: string;
    display_name: string;
    full_name: string | null;
    email: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    synced: number;
  }>(
    `SELECT * FROM people 
     WHERE LOWER(display_name) LIKE ? OR LOWER(full_name) LIKE ?
     ORDER BY display_name
     LIMIT 10`,
    [pattern, pattern]
  );
  
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    fullName: row.full_name,
    email: row.email,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1
  }));
}

export async function getPerson(id: string): Promise<Person | null> {
  const db = await dbPromise;
  const row = await db.getFirstAsync<{
    id: string;
    display_name: string;
    full_name: string | null;
    email: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    synced: number;
  }>('SELECT * FROM people WHERE id = ? LIMIT 1', [id]);
  
  if (!row) return null;
  
  return {
    id: row.id,
    displayName: row.display_name,
    fullName: row.full_name,
    email: row.email,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1
  };
}

export async function upsertPerson(person: Person) {
  const db = await dbPromise;
  await db.runAsync(
    `INSERT INTO people (id, display_name, full_name, email, notes, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       display_name = excluded.display_name,
       full_name = excluded.full_name,
       email = excluded.email,
       notes = excluded.notes,
       updated_at = excluded.updated_at,
       synced = excluded.synced;
    `,
    [
      person.id,
      person.displayName,
      person.fullName ?? null,
      person.email ?? null,
      person.notes ?? null,
      person.createdAt,
      person.updatedAt,
      person.synced ? 1 : 0
    ]
  );
}

export async function deletePerson(id: string) {
  const db = await dbPromise;
  await db.runAsync('DELETE FROM people WHERE id = ?;', [id]);
}

// ========== Meeting-Person associations ==========

export async function getMeetingPeople(meetingId: string): Promise<(Person & { role: string })[]> {
  const db = await dbPromise;
  const rows = await db.getAllAsync<{
    id: string;
    display_name: string;
    full_name: string | null;
    email: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    synced: number;
    role: string;
  }>(
    `SELECT p.*, mp.role FROM people p 
     JOIN meeting_people mp ON p.id = mp.person_id 
     WHERE mp.meeting_id = ? 
     ORDER BY mp.role, p.display_name`,
    [meetingId]
  );
  
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    fullName: row.full_name,
    email: row.email,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1,
    role: row.role
  }));
}

export async function addPersonToMeeting(meetingId: string, personId: string, role: 'participant' | 'mentioned') {
  const db = await dbPromise;
  await db.runAsync(
    `INSERT OR IGNORE INTO meeting_people (meeting_id, person_id, role, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [meetingId, personId, role]
  );
}

export async function removePersonFromMeeting(meetingId: string, personId: string, role: 'participant' | 'mentioned') {
  const db = await dbPromise;
  await db.runAsync(
    'DELETE FROM meeting_people WHERE meeting_id = ? AND person_id = ? AND role = ?',
    [meetingId, personId, role]
  );
}
