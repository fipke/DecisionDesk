// ───────────────────────────────────────────────────────────────
// Repositories — CRUD operations on the local SQLite database.
// Every mutating operation also enqueues a sync_queue entry so
// changes are pushed to the backend when connectivity returns.
// ───────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { getDatabase } from './database';
import type {
  Meeting, Folder, MeetingType, Person, MeetingPerson,
  NoteBlock, Summary, MeetingSeries, MeetingSeriesEntry,
  Template, SyncQueueItem, SyncAction
} from '../shared/types';

// ─── Helpers ─────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function enqueue(
  db: Database.Database,
  tableName: string,
  recordId: string,
  action: SyncAction,
  payload: Record<string, unknown>
): void {
  db.prepare(
    'INSERT INTO sync_queue (table_name, record_id, action, payload, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(tableName, recordId, action, JSON.stringify(payload), Date.now());
}

// ═══════════════════════════════════════════════════════════════
// Meetings
// ═══════════════════════════════════════════════════════════════

export function listMeetings(): Meeting[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id, remote_id, created_at, status, recording_uri,
            transcript_text, language, cost_usd, cost_brl, minutes,
            folder_id, meeting_type_id, tags, title, updated_at
     FROM meetings ORDER BY datetime(created_at) DESC`
  ).all() as any[];

  return rows.map(mapMeetingRow);
}

export function listMeetingsByFolder(folderId: string): Meeting[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id, remote_id, created_at, status, recording_uri,
            transcript_text, language, cost_usd, cost_brl, minutes,
            folder_id, meeting_type_id, tags, title, updated_at
     FROM meetings WHERE folder_id = ? ORDER BY datetime(created_at) DESC`
  ).all(folderId) as any[];

  return rows.map(mapMeetingRow);
}

export function getMeeting(id: string): Meeting | null {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT id, remote_id, created_at, status, recording_uri,
            transcript_text, language, cost_usd, cost_brl, minutes,
            folder_id, meeting_type_id, tags, title, updated_at
     FROM meetings WHERE id = ?`
  ).get(id) as any | undefined;

  return row ? mapMeetingRow(row) : null;
}

export function upsertMeeting(meeting: Partial<Meeting> & { id?: string }, enqueueSync = true): Meeting {
  const db = getDatabase();
  const id = meeting.id || uuid();
  const ts = now();

  db.prepare(`
    INSERT INTO meetings (id, remote_id, created_at, status, recording_uri, transcript_text, language,
                          cost_usd, cost_brl, minutes, folder_id, meeting_type_id, tags, title, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      remote_id = excluded.remote_id,
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
      updated_at = excluded.updated_at
  `).run(
    id,
    meeting.remoteId ?? null,
    meeting.createdAt ?? ts,
    meeting.status ?? 'NEW',
    meeting.recordingUri ?? null,
    meeting.transcriptText ?? null,
    meeting.language ?? null,
    meeting.costUsd ?? null,
    meeting.costBrl ?? null,
    meeting.minutes ?? null,
    meeting.folderId ?? null,
    meeting.meetingTypeId ?? null,
    meeting.tags ? JSON.stringify(meeting.tags) : '{}',
    meeting.title ?? null,
    meeting.updatedAt ?? ts
  );

  const saved = getMeeting(id)!;

  if (enqueueSync) {
    const action: SyncAction = meeting.id ? 'UPDATE' : 'CREATE';
    enqueue(db, 'meetings', id, action, saved as any);
  }

  return saved;
}

export function deleteMeeting(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
  enqueue(db, 'meetings', id, 'DELETE', { id });
}

function mapMeetingRow(row: any): Meeting {
  return {
    id: row.id,
    remoteId: row.remote_id ?? null,
    createdAt: row.created_at,
    status: row.status,
    recordingUri: row.recording_uri ?? null,
    transcriptText: row.transcript_text ?? null,
    language: row.language ?? null,
    costUsd: row.cost_usd ?? null,
    costBrl: row.cost_brl ?? null,
    minutes: row.minutes ?? null,
    folderId: row.folder_id ?? null,
    meetingTypeId: row.meeting_type_id ?? null,
    tags: row.tags ? JSON.parse(row.tags) : {},
    title: row.title ?? null,
    updatedAt: row.updated_at ?? null
  };
}

// ═══════════════════════════════════════════════════════════════
// Folders
// ═══════════════════════════════════════════════════════════════

export function listFolders(): Folder[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM folders ORDER BY path').all() as any[];
  return rows.map(mapFolderRow);
}

export function getFolder(id: string): Folder | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as any | undefined;
  return row ? mapFolderRow(row) : null;
}

export function upsertFolder(folder: Partial<Folder> & { name: string }, enqueueSync = true): Folder {
  const db = getDatabase();
  const id = folder.id || uuid();
  const ts = now();

  db.prepare(`
    INSERT INTO folders (id, name, path, parent_id, default_tags, default_whisper_model, created_at, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      path = excluded.path,
      parent_id = excluded.parent_id,
      default_tags = excluded.default_tags,
      default_whisper_model = excluded.default_whisper_model,
      updated_at = excluded.updated_at,
      synced = excluded.synced
  `).run(
    id,
    folder.name,
    folder.path ?? `/${folder.name}`,
    folder.parentId ?? null,
    folder.defaultTags ? JSON.stringify(folder.defaultTags) : '{}',
    folder.defaultWhisperModel ?? null,
    folder.createdAt ?? ts,
    folder.updatedAt ?? ts,
    folder.synced ? 1 : 0
  );

  const saved = getFolder(id)!;
  if (enqueueSync) {
    enqueue(db, 'folders', id, folder.id ? 'UPDATE' : 'CREATE', saved as any);
  }
  return saved;
}

export function deleteFolder(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  enqueue(db, 'folders', id, 'DELETE', { id });
}

function mapFolderRow(row: any): Folder {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    parentId: row.parent_id ?? null,
    defaultTags: row.default_tags ? JSON.parse(row.default_tags) : {},
    defaultWhisperModel: row.default_whisper_model ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1
  };
}

// ═══════════════════════════════════════════════════════════════
// Meeting Types
// ═══════════════════════════════════════════════════════════════

export function listMeetingTypes(): MeetingType[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM meeting_types ORDER BY name').all() as any[];
  return rows.map(mapMeetingTypeRow);
}

export function getMeetingType(id: string): MeetingType | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM meeting_types WHERE id = ?').get(id) as any | undefined;
  return row ? mapMeetingTypeRow(row) : null;
}

export function upsertMeetingType(mt: Partial<MeetingType> & { name: string }, enqueueSync = true): MeetingType {
  const db = getDatabase();
  const id = mt.id || uuid();
  const ts = now();

  db.prepare(`
    INSERT INTO meeting_types (id, name, description, required_tags, default_whisper_model, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      required_tags = excluded.required_tags,
      default_whisper_model = excluded.default_whisper_model,
      synced = excluded.synced
  `).run(
    id,
    mt.name,
    mt.description ?? null,
    mt.requiredTags ? JSON.stringify(mt.requiredTags) : '{}',
    mt.defaultWhisperModel ?? null,
    mt.createdAt ?? ts,
    mt.synced ? 1 : 0
  );

  const saved = getMeetingType(id)!;
  if (enqueueSync) {
    enqueue(db, 'meeting_types', id, mt.id ? 'UPDATE' : 'CREATE', saved as any);
  }
  return saved;
}

function mapMeetingTypeRow(row: any): MeetingType {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    requiredTags: row.required_tags ? JSON.parse(row.required_tags) : {},
    defaultWhisperModel: row.default_whisper_model ?? null,
    createdAt: row.created_at,
    synced: row.synced === 1
  };
}

// ═══════════════════════════════════════════════════════════════
// People
// ═══════════════════════════════════════════════════════════════

export function listPeople(): Person[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM people ORDER BY display_name').all() as any[];
  return rows.map(mapPersonRow);
}

export function getPerson(id: string): Person | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM people WHERE id = ?').get(id) as any | undefined;
  return row ? mapPersonRow(row) : null;
}

export function upsertPerson(p: Partial<Person> & { displayName: string }, enqueueSync = true): Person {
  const db = getDatabase();
  const id = p.id || uuid();
  const ts = now();

  db.prepare(`
    INSERT INTO people (id, display_name, full_name, email, notes, created_at, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      full_name = excluded.full_name,
      email = excluded.email,
      notes = excluded.notes,
      updated_at = excluded.updated_at,
      synced = excluded.synced
  `).run(
    id,
    p.displayName,
    p.fullName ?? null,
    p.email ?? null,
    p.notes ?? null,
    p.createdAt ?? ts,
    p.updatedAt ?? ts,
    p.synced ? 1 : 0
  );

  const saved = getPerson(id)!;
  if (enqueueSync) {
    enqueue(db, 'people', id, p.id ? 'UPDATE' : 'CREATE', saved as any);
  }
  return saved;
}

export function deletePerson(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM people WHERE id = ?').run(id);
  enqueue(db, 'people', id, 'DELETE', { id });
}

function mapPersonRow(row: any): Person {
  return {
    id: row.id,
    displayName: row.display_name,
    fullName: row.full_name ?? null,
    email: row.email ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: row.synced === 1
  };
}

// ═══════════════════════════════════════════════════════════════
// Meeting × People associations
// ═══════════════════════════════════════════════════════════════

export function listMeetingPeople(meetingId: string): MeetingPerson[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT meeting_id, person_id, role, created_at FROM meeting_people WHERE meeting_id = ?'
  ).all(meetingId) as any[];

  return rows.map((r) => ({
    meetingId: r.meeting_id,
    personId: r.person_id,
    role: r.role,
    createdAt: r.created_at
  }));
}

export function addMeetingPerson(mp: MeetingPerson, enqueueSync = true): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO meeting_people (meeting_id, person_id, role, created_at)
    VALUES (?, ?, ?, ?)
  `).run(mp.meetingId, mp.personId, mp.role, mp.createdAt || now());

  if (enqueueSync) {
    enqueue(db, 'meeting_people', `${mp.meetingId}:${mp.personId}:${mp.role}`, 'CREATE', mp as any);
  }
}

export function removeMeetingPerson(meetingId: string, personId: string, role: string): void {
  const db = getDatabase();
  db.prepare(
    'DELETE FROM meeting_people WHERE meeting_id = ? AND person_id = ? AND role = ?'
  ).run(meetingId, personId, role);
  enqueue(db, 'meeting_people', `${meetingId}:${personId}:${role}`, 'DELETE', { meetingId, personId, role });
}

// ═══════════════════════════════════════════════════════════════
// Note Blocks
// ═══════════════════════════════════════════════════════════════

export function listNoteBlocks(meetingId: string): NoteBlock[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM note_blocks WHERE meeting_id = ? ORDER BY ordinal'
  ).all(meetingId) as any[];

  return rows.map(mapNoteBlockRow);
}

export function upsertNoteBlock(nb: Partial<NoteBlock> & { meetingId: string; content: string }, enqueueSync = true): NoteBlock {
  const db = getDatabase();
  const id = nb.id || uuid();
  const ts = now();

  // Auto-assign ordinal if not specified
  let ordinal = nb.ordinal;
  if (ordinal === undefined) {
    const max = db.prepare(
      'SELECT MAX(ordinal) as maxOrd FROM note_blocks WHERE meeting_id = ?'
    ).get(nb.meetingId) as any;
    ordinal = (max?.maxOrd ?? -1) + 1;
  }

  db.prepare(`
    INSERT INTO note_blocks (id, meeting_id, ordinal, block_type, content, checked, speaker_label, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      ordinal = excluded.ordinal,
      block_type = excluded.block_type,
      content = excluded.content,
      checked = excluded.checked,
      speaker_label = excluded.speaker_label,
      updated_at = excluded.updated_at
  `).run(
    id,
    nb.meetingId,
    ordinal,
    nb.blockType ?? 'paragraph',
    nb.content,
    nb.checked ? 1 : 0,
    nb.speakerLabel ?? null,
    nb.createdAt ?? ts,
    nb.updatedAt ?? ts
  );

  const saved = db.prepare('SELECT * FROM note_blocks WHERE id = ?').get(id) as any;
  const result = mapNoteBlockRow(saved);

  if (enqueueSync) {
    enqueue(db, 'note_blocks', id, nb.id ? 'UPDATE' : 'CREATE', result as any);
  }
  return result;
}

export function deleteNoteBlock(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM note_blocks WHERE id = ?').run(id);
  enqueue(db, 'note_blocks', id, 'DELETE', { id });
}

function mapNoteBlockRow(row: any): NoteBlock {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    ordinal: row.ordinal,
    blockType: row.block_type,
    content: row.content,
    checked: row.checked === 1,
    speakerLabel: row.speaker_label ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ═══════════════════════════════════════════════════════════════
// Summaries
// ═══════════════════════════════════════════════════════════════

export function listSummaries(meetingId: string): Summary[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM summaries WHERE meeting_id = ? ORDER BY created_at DESC'
  ).all(meetingId) as any[];

  return rows.map(mapSummaryRow);
}

export function upsertSummary(s: Partial<Summary> & { meetingId: string; bodyMarkdown: string }, enqueueSync = true): Summary {
  const db = getDatabase();
  const id = s.id || uuid();
  const ts = now();

  db.prepare(`
    INSERT INTO summaries (id, meeting_id, provider, model, style, body_markdown, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      body_markdown = excluded.body_markdown
  `).run(
    id,
    s.meetingId,
    s.provider ?? 'local',
    s.model ?? 'unknown',
    s.style ?? 'brief',
    s.bodyMarkdown,
    s.createdAt ?? ts
  );

  const saved = db.prepare('SELECT * FROM summaries WHERE id = ?').get(id) as any;
  const result = mapSummaryRow(saved);

  if (enqueueSync) {
    enqueue(db, 'summaries', id, s.id ? 'UPDATE' : 'CREATE', result as any);
  }
  return result;
}

function mapSummaryRow(row: any): Summary {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    provider: row.provider,
    model: row.model,
    style: row.style,
    bodyMarkdown: row.body_markdown,
    createdAt: row.created_at
  };
}

// ═══════════════════════════════════════════════════════════════
// Meeting Series
// ═══════════════════════════════════════════════════════════════

export function listMeetingSeries(): MeetingSeries[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM meeting_series ORDER BY name').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    rrule: r.rrule ?? null,
    folderId: r.folder_id ?? null,
    meetingTypeId: r.meeting_type_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export function upsertMeetingSeries(ms: Partial<MeetingSeries> & { name: string }, enqueueSync = true): MeetingSeries {
  const db = getDatabase();
  const id = ms.id || uuid();
  const ts = now();

  db.prepare(`
    INSERT INTO meeting_series (id, name, rrule, folder_id, meeting_type_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      rrule = excluded.rrule,
      folder_id = excluded.folder_id,
      meeting_type_id = excluded.meeting_type_id,
      updated_at = excluded.updated_at
  `).run(id, ms.name, ms.rrule ?? null, ms.folderId ?? null, ms.meetingTypeId ?? null, ms.createdAt ?? ts, ms.updatedAt ?? ts);

  const saved = db.prepare('SELECT * FROM meeting_series WHERE id = ?').get(id) as any;
  const result: MeetingSeries = {
    id: saved.id, name: saved.name, rrule: saved.rrule ?? null,
    folderId: saved.folder_id ?? null, meetingTypeId: saved.meeting_type_id ?? null,
    createdAt: saved.created_at, updatedAt: saved.updated_at
  };

  if (enqueueSync) {
    enqueue(db, 'meeting_series', id, ms.id ? 'UPDATE' : 'CREATE', result as any);
  }
  return result;
}

// ─── Series entries ──────────────────────────────────────────

export function listSeriesEntries(seriesId: string): MeetingSeriesEntry[] {
  const db = getDatabase();
  return db.prepare(
    'SELECT meeting_id, series_id, ordinal FROM meeting_series_entries WHERE series_id = ? ORDER BY ordinal'
  ).all(seriesId) as any[];
}

export function addSeriesEntry(entry: MeetingSeriesEntry): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO meeting_series_entries (meeting_id, series_id, ordinal) VALUES (?, ?, ?)
  `).run(entry.meetingId, entry.seriesId, entry.ordinal);
}

// ═══════════════════════════════════════════════════════════════
// Templates
// ═══════════════════════════════════════════════════════════════

export function listTemplates(): Template[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM templates ORDER BY name').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    bodyMarkdown: r.body_markdown,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export function upsertTemplate(t: Partial<Template> & { name: string; bodyMarkdown: string }, enqueueSync = true): Template {
  const db = getDatabase();
  const id = t.id || uuid();
  const ts = now();

  db.prepare(`
    INSERT INTO templates (id, name, body_markdown, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      body_markdown = excluded.body_markdown,
      updated_at = excluded.updated_at
  `).run(id, t.name, t.bodyMarkdown, t.createdAt ?? ts, t.updatedAt ?? ts);

  const saved = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
  const result: Template = {
    id: saved.id, name: saved.name, bodyMarkdown: saved.body_markdown,
    createdAt: saved.created_at, updatedAt: saved.updated_at
  };

  if (enqueueSync) {
    enqueue(db, 'templates', id, t.id ? 'UPDATE' : 'CREATE', result as any);
  }
  return result;
}

export function deleteTemplate(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  enqueue(db, 'templates', id, 'DELETE', { id });
}

// ═══════════════════════════════════════════════════════════════
// Sync Queue
// ═══════════════════════════════════════════════════════════════

export function listSyncQueue(): SyncQueueItem[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id, table_name, record_id, action, payload, created_at, retries, last_error
     FROM sync_queue ORDER BY created_at ASC`
  ).all() as any[];

  return rows.map((r) => ({
    id: r.id,
    tableName: r.table_name,
    recordId: r.record_id,
    action: r.action,
    payload: r.payload,
    createdAt: r.created_at,
    retries: r.retries,
    lastError: r.last_error ?? null
  }));
}

export function syncQueueCount(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM sync_queue').get() as any;
  return row.cnt;
}

export function removeSyncItem(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM sync_queue WHERE id = ?').run(id);
}

export function markSyncItemFailed(id: number, error: string): void {
  const db = getDatabase();
  db.prepare(
    'UPDATE sync_queue SET retries = retries + 1, last_error = ? WHERE id = ?'
  ).run(error, id);
}
