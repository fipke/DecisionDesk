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
  Template, SyncQueueItem, SyncAction,
  TranscriptSegment, MeetingSpeaker,
  ActionItem, ExtractedActionItem
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
            transcript_text, language, cost_usd, cost_brl, minutes, duration_sec,
            folder_id, meeting_type_id, tags, title, summary_snippet, updated_at
     FROM meetings ORDER BY datetime(created_at) DESC`
  ).all() as any[];

  return rows.map(mapMeetingRow);
}

export function listMeetingsByFolder(folderId: string): Meeting[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id, remote_id, created_at, status, recording_uri,
            transcript_text, language, cost_usd, cost_brl, minutes, duration_sec,
            folder_id, meeting_type_id, tags, title, summary_snippet, updated_at
     FROM meetings WHERE folder_id = ? ORDER BY datetime(created_at) DESC`
  ).all(folderId) as any[];

  return rows.map(mapMeetingRow);
}

export function getMeeting(id: string): Meeting | null {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT id, remote_id, created_at, status, recording_uri,
            transcript_text, language, cost_usd, cost_brl, minutes, duration_sec,
            folder_id, meeting_type_id, tags, title, summary_snippet, updated_at
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
                          cost_usd, cost_brl, minutes, duration_sec, folder_id, meeting_type_id, tags, title, summary_snippet, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      remote_id = excluded.remote_id,
      status = excluded.status,
      recording_uri = excluded.recording_uri,
      transcript_text = excluded.transcript_text,
      language = excluded.language,
      cost_usd = excluded.cost_usd,
      cost_brl = excluded.cost_brl,
      minutes = excluded.minutes,
      duration_sec = excluded.duration_sec,
      folder_id = excluded.folder_id,
      meeting_type_id = excluded.meeting_type_id,
      tags = excluded.tags,
      title = excluded.title,
      summary_snippet = excluded.summary_snippet,
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
    meeting.durationSec ?? null,
    meeting.folderId ?? null,
    meeting.meetingTypeId ?? null,
    meeting.tags ? JSON.stringify(meeting.tags) : '{}',
    meeting.title ?? null,
    meeting.summarySnippet ?? null,
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
    durationSec: row.duration_sec ?? null,
    folderId: row.folder_id ?? null,
    meetingTypeId: row.meeting_type_id ?? null,
    meetingTypeName: row.meeting_type_name ?? null,
    tags: row.tags ? JSON.parse(row.tags) : {},
    title: row.title ?? null,
    summarySnippet: row.summary_snippet ?? null,
    updatedAt: row.updated_at ?? null
  };
}

export function updateSummarySnippet(meetingId: string, snippet: string): void {
  const db = getDatabase();
  db.prepare('UPDATE meetings SET summary_snippet = ?, updated_at = ? WHERE id = ?')
    .run(snippet, now(), meetingId);
}

export function listAllTags(): string[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT tags FROM meetings WHERE tags != '{}' AND tags IS NOT NULL").all() as any[];
  const tagSet = new Set<string>();
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.tags || '{}');
      for (const v of Object.values(parsed)) {
        if (v) tagSet.add(v as string);
      }
    } catch { /* skip malformed */ }
  }
  return [...tagSet].sort();
}

export interface PersonMeetingRow {
  meetingId: string;
  title: string | null;
  createdAt: string;
  role: string;
  talkTimeSec: number;
}

export function listMeetingsForPerson(personId: string): PersonMeetingRow[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT m.id as meeting_id, m.title, m.created_at, mp.role,
           COALESCE(ms.talk_time_sec, 0) as talk_time_sec
    FROM meeting_people mp
    JOIN meetings m ON m.id = mp.meeting_id
    LEFT JOIN meeting_speakers ms ON ms.meeting_id = m.id AND ms.person_id = mp.person_id
    WHERE mp.person_id = ?
    ORDER BY m.created_at DESC
  `).all(personId) as any[];
  return rows.map(r => ({
    meetingId: r.meeting_id,
    title: r.title,
    createdAt: r.created_at,
    role: r.role,
    talkTimeSec: r.talk_time_sec,
  }));
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

function mapTemplateRow(r: any): Template {
  return {
    id: r.id,
    name: r.name,
    bodyMarkdown: r.body_markdown,
    description: r.description ?? undefined,
    systemPrompt: r.system_prompt ?? undefined,
    userPromptTemplate: r.user_prompt_template ?? undefined,
    outputFormat: r.output_format ?? undefined,
    model: r.model ?? undefined,
    maxTokens: r.max_tokens ?? undefined,
    temperature: r.temperature ?? undefined,
    isDefault: r.is_default === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function listTemplates(): Template[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM templates ORDER BY name').all() as any[];
  return rows.map(mapTemplateRow);
}

export function upsertTemplate(t: Partial<Template> & { name: string }, enqueueSync = true): Template {
  const db = getDatabase();
  const id = t.id || uuid();
  const ts = now();

  db.prepare(`
    INSERT INTO templates (id, name, body_markdown, description, system_prompt, user_prompt_template, output_format, model, max_tokens, temperature, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      body_markdown = excluded.body_markdown,
      description = excluded.description,
      system_prompt = excluded.system_prompt,
      user_prompt_template = excluded.user_prompt_template,
      output_format = excluded.output_format,
      model = excluded.model,
      max_tokens = excluded.max_tokens,
      temperature = excluded.temperature,
      is_default = excluded.is_default,
      updated_at = excluded.updated_at
  `).run(
    id, t.name, t.bodyMarkdown ?? '',
    t.description ?? '', t.systemPrompt ?? '', t.userPromptTemplate ?? '',
    t.outputFormat ?? 'markdown', t.model ?? 'qwen3:14b',
    t.maxTokens ?? 2000, t.temperature ?? 0.3,
    t.isDefault ? 1 : 0,
    t.createdAt ?? ts, t.updatedAt ?? ts
  );

  const saved = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
  const result = mapTemplateRow(saved);

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
// Meeting Speakers
// ═══════════════════════════════════════════════════════════════

export function listMeetingSpeakers(meetingId: string): MeetingSpeaker[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM meeting_speakers WHERE meeting_id = ? ORDER BY color_index'
  ).all(meetingId) as any[];
  return rows.map(mapMeetingSpeakerRow);
}

export function getMeetingSpeaker(id: string): MeetingSpeaker | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM meeting_speakers WHERE id = ?').get(id) as any | undefined;
  return row ? mapMeetingSpeakerRow(row) : null;
}

export function upsertMeetingSpeaker(
  speaker: Partial<MeetingSpeaker> & { meetingId: string; label: string },
  enqueueSync = true
): MeetingSpeaker {
  const db = getDatabase();
  const id = speaker.id || uuid();
  const ts = now();

  db.prepare(`
    INSERT INTO meeting_speakers (id, meeting_id, label, display_name, person_id, color_index, talk_time_sec, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      person_id = excluded.person_id,
      color_index = excluded.color_index,
      talk_time_sec = excluded.talk_time_sec,
      updated_at = excluded.updated_at
  `).run(
    id,
    speaker.meetingId,
    speaker.label,
    speaker.displayName ?? null,
    speaker.personId ?? null,
    speaker.colorIndex ?? 0,
    speaker.talkTimeSec ?? 0,
    speaker.createdAt ?? ts,
    speaker.updatedAt ?? ts
  );

  const saved = getMeetingSpeaker(id)!;
  if (enqueueSync) {
    enqueue(db, 'meeting_speakers', id, speaker.id ? 'UPDATE' : 'CREATE', saved as any);
  }
  return saved;
}

export function deleteMeetingSpeaker(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM meeting_speakers WHERE id = ?').run(id);
  enqueue(db, 'meeting_speakers', id, 'DELETE', { id });
}

export function mergeSpeakers(meetingId: string, keepId: string, absorbId: string): void {
  const db = getDatabase();
  db.transaction(() => {
    // Reassign all segments from absorbed speaker to kept speaker
    const kept = getMeetingSpeaker(keepId);
    if (!kept) throw new Error(`Speaker ${keepId} not found`);

    db.prepare(
      'UPDATE transcript_segments SET speaker_id = ?, speaker_label = ? WHERE meeting_id = ? AND speaker_id = ?'
    ).run(keepId, kept.label, meetingId, absorbId);

    // Delete absorbed speaker
    db.prepare('DELETE FROM meeting_speakers WHERE id = ?').run(absorbId);

    // Recalculate talk time for kept speaker
    const result = db.prepare(
      'SELECT COALESCE(SUM(end_sec - start_sec), 0) as total FROM transcript_segments WHERE meeting_id = ? AND speaker_id = ?'
    ).get(meetingId, keepId) as any;
    db.prepare(
      'UPDATE meeting_speakers SET talk_time_sec = ?, updated_at = ? WHERE id = ?'
    ).run(result.total, now(), keepId);
  })();

  // Enqueue sync for both
  enqueue(db, 'meeting_speakers', keepId, 'UPDATE', { meetingId, keepId, absorbId });
}

function mapMeetingSpeakerRow(row: any): MeetingSpeaker {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    label: row.label,
    displayName: row.display_name ?? null,
    personId: row.person_id ?? null,
    colorIndex: row.color_index,
    talkTimeSec: row.talk_time_sec,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ═══════════════════════════════════════════════════════════════
// Transcript Segments
// ═══════════════════════════════════════════════════════════════

export function listSegments(meetingId: string): TranscriptSegment[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM transcript_segments WHERE meeting_id = ? ORDER BY ordinal'
  ).all(meetingId) as any[];
  return rows.map(mapSegmentRow);
}

export function insertSegmentsBatch(
  meetingId: string,
  segments: Array<Omit<TranscriptSegment, 'id'> & { id?: string }>
): TranscriptSegment[] {
  const db = getDatabase();
  const ts = now();

  const stmt = db.prepare(`
    INSERT INTO transcript_segments (id, meeting_id, ordinal, start_sec, end_sec, text, speaker_label, speaker_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const results: TranscriptSegment[] = [];

  db.transaction(() => {
    for (const seg of segments) {
      const id = seg.id || uuid();
      stmt.run(
        id,
        meetingId,
        seg.ordinal,
        seg.startSec,
        seg.endSec,
        seg.text,
        seg.speakerLabel ?? null,
        seg.speakerId ?? null,
        ts
      );
      results.push({
        id,
        meetingId,
        ordinal: seg.ordinal,
        startSec: seg.startSec,
        endSec: seg.endSec,
        text: seg.text,
        speakerLabel: seg.speakerLabel ?? null,
        speakerId: seg.speakerId ?? null,
      });
    }
  })();

  // Enqueue a single sync item for the batch
  enqueue(db, 'transcript_segments', meetingId, 'CREATE', { meetingId, count: segments.length });

  return results;
}

export function deleteSegments(meetingId: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM transcript_segments WHERE meeting_id = ?').run(meetingId);
  // Also delete speakers for this meeting
  db.prepare('DELETE FROM meeting_speakers WHERE meeting_id = ?').run(meetingId);
}

export function updateSegmentSpeaker(segmentId: string, speakerId: string, speakerLabel: string): void {
  const db = getDatabase();
  db.prepare(
    'UPDATE transcript_segments SET speaker_id = ?, speaker_label = ? WHERE id = ?'
  ).run(speakerId, speakerLabel, segmentId);
  enqueue(db, 'transcript_segments', segmentId, 'UPDATE', { segmentId, speakerId, speakerLabel });
}

function mapSegmentRow(row: any): TranscriptSegment {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    ordinal: row.ordinal,
    startSec: row.start_sec,
    endSec: row.end_sec,
    text: row.text,
    speakerLabel: row.speaker_label ?? null,
    speakerId: row.speaker_id ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════
// Action Items
// ═══════════════════════════════════════════════════════════════

function mapActionItemRow(row: any): ActionItem {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    seriesId: row.series_id ?? null,
    content: row.content,
    assigneeName: row.assignee_name ?? null,
    assigneeId: row.assignee_id ?? null,
    dueDate: row.due_date ?? null,
    status: row.status,
    resolvedAt: row.resolved_at ?? null,
    resolvedInMeetingId: row.resolved_in_meeting_id ?? null,
    ordinal: row.ordinal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    meetingTitle: row.meeting_title ?? undefined,
    meetingCreatedAt: row.meeting_created_at ?? undefined,
  };
}

export function listActionItems(meetingId: string): ActionItem[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT * FROM action_items WHERE meeting_id = ? ORDER BY ordinal'
  ).all(meetingId) as any[];
  return rows.map(mapActionItemRow);
}

export function listOpenActionItemsForSeries(seriesId: string): ActionItem[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT ai.*, m.title as meeting_title, m.created_at as meeting_created_at
     FROM action_items ai
     JOIN meetings m ON m.id = ai.meeting_id
     WHERE ai.series_id = ? AND ai.status = 'open'
     ORDER BY m.created_at ASC, ai.ordinal ASC`
  ).all(seriesId) as any[];
  return rows.map(mapActionItemRow);
}

export function upsertActionItem(
  item: Partial<ActionItem> & { meetingId: string; content: string },
  enqueueSync = true
): ActionItem {
  const db = getDatabase();
  const id = item.id || uuid();
  const ts = now();
  let ordinal = item.ordinal;
  if (ordinal === undefined) {
    const max = db.prepare(
      'SELECT MAX(ordinal) as maxOrd FROM action_items WHERE meeting_id = ?'
    ).get(item.meetingId) as any;
    ordinal = (max?.maxOrd ?? -1) + 1;
  }
  db.prepare(`
    INSERT INTO action_items (id, meeting_id, series_id, content, assignee_name, assignee_id,
                               due_date, status, resolved_at, resolved_in_meeting_id, ordinal, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      assignee_name = excluded.assignee_name,
      assignee_id = excluded.assignee_id,
      due_date = excluded.due_date,
      status = excluded.status,
      resolved_at = excluded.resolved_at,
      resolved_in_meeting_id = excluded.resolved_in_meeting_id,
      ordinal = excluded.ordinal,
      updated_at = excluded.updated_at
  `).run(
    id, item.meetingId, item.seriesId ?? null,
    item.content, item.assigneeName ?? null, item.assigneeId ?? null,
    item.dueDate ?? null, item.status ?? 'open',
    item.resolvedAt ?? null, item.resolvedInMeetingId ?? null,
    ordinal, item.createdAt ?? ts, ts
  );
  const saved = db.prepare('SELECT * FROM action_items WHERE id = ?').get(id) as any;
  const result = mapActionItemRow(saved);
  if (enqueueSync) {
    enqueue(db, 'action_items', id, item.id ? 'UPDATE' : 'CREATE', result as any);
  }
  return result;
}

export function toggleActionItemStatus(id: string, resolvedInMeetingId: string): ActionItem {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM action_items WHERE id = ?').get(id) as any;
  if (!existing) throw new Error(`Action item ${id} not found`);
  const newStatus = existing.status === 'open' ? 'done' : 'open';
  const ts = now();
  db.prepare(`
    UPDATE action_items SET status = ?, resolved_at = ?, resolved_in_meeting_id = ?, updated_at = ?
    WHERE id = ?
  `).run(
    newStatus,
    newStatus === 'done' ? ts : null,
    newStatus === 'done' ? resolvedInMeetingId : null,
    ts, id
  );
  const saved = db.prepare('SELECT * FROM action_items WHERE id = ?').get(id) as any;
  const result = mapActionItemRow(saved);
  enqueue(db, 'action_items', id, 'UPDATE', result as any);
  return result;
}

export function deleteActionItem(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM action_items WHERE id = ?').run(id);
  enqueue(db, 'action_items', id, 'DELETE', { id });
}

export function insertActionItemsBatch(
  meetingId: string,
  seriesId: string | null,
  items: ExtractedActionItem[],
  people: Person[]
): ActionItem[] {
  const db = getDatabase();
  const ts = now();
  const results: ActionItem[] = [];

  const stmt = db.prepare(`
    INSERT INTO action_items (id, meeting_id, series_id, content, assignee_name, assignee_id,
                               due_date, status, ordinal, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `);

  db.transaction(() => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = uuid();
      let assigneeId: string | null = null;
      if (item.assignee) {
        const match = people.find(p =>
          p.displayName.toLowerCase() === item.assignee!.toLowerCase() ||
          (p.fullName && p.fullName.toLowerCase() === item.assignee!.toLowerCase())
        );
        if (match) assigneeId = match.id;
      }
      stmt.run(id, meetingId, seriesId, item.content, item.assignee ?? null,
               assigneeId, item.dueDate ?? null, i, ts, ts);
      results.push({
        id, meetingId, seriesId, content: item.content,
        assigneeName: item.assignee ?? null, assigneeId,
        dueDate: item.dueDate ?? null, status: 'open',
        resolvedAt: null, resolvedInMeetingId: null,
        ordinal: i, createdAt: ts, updatedAt: ts
      });
    }
  })();

  if (results.length > 0) {
    enqueue(db, 'action_items', meetingId, 'CREATE', { meetingId, count: results.length });
  }
  return results;
}

export function getSeriesIdForMeeting(meetingId: string): string | null {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT series_id FROM meeting_series_entries WHERE meeting_id = ? LIMIT 1'
  ).get(meetingId) as any | undefined;
  return row?.series_id ?? null;
}

// ─── Enhanced series entry management (with sync) ────────────

export function addSeriesEntryWithSync(entry: MeetingSeriesEntry): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO meeting_series_entries (meeting_id, series_id, ordinal) VALUES (?, ?, ?)
  `).run(entry.meetingId, entry.seriesId, entry.ordinal);
  enqueue(db, 'meeting_series_entries', `${entry.meetingId}:${entry.seriesId}`, 'CREATE', entry as any);
}

export function removeSeriesEntry(meetingId: string, seriesId: string): void {
  const db = getDatabase();
  db.prepare(
    'DELETE FROM meeting_series_entries WHERE meeting_id = ? AND series_id = ?'
  ).run(meetingId, seriesId);
  enqueue(db, 'meeting_series_entries', `${meetingId}:${seriesId}`, 'DELETE', { meetingId, seriesId });
}

export function getNextOrdinalForSeries(seriesId: string): number {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT MAX(ordinal) as maxOrd FROM meeting_series_entries WHERE series_id = ?'
  ).get(seriesId) as any;
  return (row?.maxOrd ?? -1) + 1;
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
