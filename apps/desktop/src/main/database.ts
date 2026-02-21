// ───────────────────────────────────────────────────────────────
// SQLite database for offline-first persistence (main process)
// Uses better-sqlite3 (synchronous, WAL mode)
// ───────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

let db: Database.Database;

/** Open (or create) the local SQLite database and run migrations. */
export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData');
  const dbDir = join(userDataPath, 'data');
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  const dbPath = join(dbDir, 'decisiondesk.db');
  db = new Database(dbPath);

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  runMigrations(db);
  seedDefaults(db);

  return db;
}

/** Get the singleton database instance. */
export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDatabase() first');
  return db;
}

/** Close the database gracefully. */
export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}

// ─── Migrations ──────────────────────────────────────────────

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id   INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name)
  );

  for (const m of MIGRATIONS) {
    if (!applied.has(m.name)) {
      db.transaction(() => {
        db.exec(m.sql);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(m.name);
      })();
    }
  }
}

interface Migration {
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_meetings',
    sql: `
      CREATE TABLE IF NOT EXISTS meetings (
        id               TEXT PRIMARY KEY NOT NULL,
        remote_id        TEXT,
        created_at       TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'NEW',
        recording_uri    TEXT,
        transcript_text  TEXT,
        language         TEXT,
        cost_usd         REAL,
        cost_brl         REAL,
        minutes          REAL,
        folder_id        TEXT,
        meeting_type_id  TEXT,
        tags             TEXT DEFAULT '{}',
        title            TEXT,
        updated_at       TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
      CREATE INDEX IF NOT EXISTS idx_meetings_folder ON meetings(folder_id);
    `
  },
  {
    name: '002_folders',
    sql: `
      CREATE TABLE IF NOT EXISTS folders (
        id                    TEXT PRIMARY KEY NOT NULL,
        name                  TEXT NOT NULL,
        path                  TEXT NOT NULL UNIQUE,
        parent_id             TEXT,
        default_tags          TEXT DEFAULT '{}',
        default_whisper_model TEXT,
        created_at            TEXT NOT NULL,
        updated_at            TEXT NOT NULL,
        synced                INTEGER DEFAULT 0
      );
    `
  },
  {
    name: '003_meeting_types',
    sql: `
      CREATE TABLE IF NOT EXISTS meeting_types (
        id                    TEXT PRIMARY KEY NOT NULL,
        name                  TEXT NOT NULL UNIQUE,
        description           TEXT,
        required_tags         TEXT DEFAULT '{}',
        default_whisper_model TEXT,
        created_at            TEXT NOT NULL,
        synced                INTEGER DEFAULT 0
      );
    `
  },
  {
    name: '004_people',
    sql: `
      CREATE TABLE IF NOT EXISTS people (
        id           TEXT PRIMARY KEY NOT NULL,
        display_name TEXT NOT NULL,
        full_name    TEXT,
        email        TEXT,
        notes        TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        synced       INTEGER DEFAULT 0
      );
    `
  },
  {
    name: '005_meeting_people',
    sql: `
      CREATE TABLE IF NOT EXISTS meeting_people (
        meeting_id TEXT NOT NULL,
        person_id  TEXT NOT NULL,
        role       TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (meeting_id, person_id, role)
      );
    `
  },
  {
    name: '006_note_blocks',
    sql: `
      CREATE TABLE IF NOT EXISTS note_blocks (
        id            TEXT PRIMARY KEY NOT NULL,
        meeting_id    TEXT NOT NULL,
        ordinal       INTEGER NOT NULL,
        block_type    TEXT NOT NULL DEFAULT 'paragraph',
        content       TEXT NOT NULL DEFAULT '',
        checked       INTEGER NOT NULL DEFAULT 0,
        speaker_label TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_note_blocks_meeting ON note_blocks(meeting_id);
    `
  },
  {
    name: '007_summaries',
    sql: `
      CREATE TABLE IF NOT EXISTS summaries (
        id             TEXT PRIMARY KEY NOT NULL,
        meeting_id     TEXT NOT NULL,
        provider       TEXT NOT NULL,
        model          TEXT NOT NULL,
        style          TEXT NOT NULL DEFAULT 'brief',
        body_markdown  TEXT NOT NULL DEFAULT '',
        created_at     TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_summaries_meeting ON summaries(meeting_id);
    `
  },
  {
    name: '008_meeting_series',
    sql: `
      CREATE TABLE IF NOT EXISTS meeting_series (
        id              TEXT PRIMARY KEY NOT NULL,
        name            TEXT NOT NULL,
        rrule           TEXT,
        folder_id       TEXT,
        meeting_type_id TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meeting_series_entries (
        meeting_id TEXT NOT NULL,
        series_id  TEXT NOT NULL,
        ordinal    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (meeting_id, series_id)
      );
    `
  },
  {
    name: '009_templates',
    sql: `
      CREATE TABLE IF NOT EXISTS templates (
        id             TEXT PRIMARY KEY NOT NULL,
        name           TEXT NOT NULL,
        body_markdown  TEXT NOT NULL DEFAULT '',
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );
    `
  },
  {
    name: '010_sync_queue',
    sql: `
      CREATE TABLE IF NOT EXISTS sync_queue (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name  TEXT NOT NULL,
        record_id   TEXT NOT NULL,
        action      TEXT NOT NULL,
        payload     TEXT NOT NULL DEFAULT '{}',
        created_at  INTEGER NOT NULL,
        retries     INTEGER NOT NULL DEFAULT 0,
        last_error  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
    `
  },
  {
    name: '011_duration_sec',
    sql: `ALTER TABLE meetings ADD COLUMN duration_sec INTEGER;`
  },
  {
    name: '012_transcript_segments',
    sql: `
      CREATE TABLE IF NOT EXISTS meeting_speakers (
        id            TEXT PRIMARY KEY NOT NULL,
        meeting_id    TEXT NOT NULL,
        label         TEXT NOT NULL,
        display_name  TEXT,
        person_id     TEXT,
        color_index   INTEGER NOT NULL DEFAULT 0,
        talk_time_sec REAL NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        UNIQUE(meeting_id, label)
      );
      CREATE INDEX IF NOT EXISTS idx_meeting_speakers_meeting ON meeting_speakers(meeting_id);

      CREATE TABLE IF NOT EXISTS transcript_segments (
        id            TEXT PRIMARY KEY NOT NULL,
        meeting_id    TEXT NOT NULL,
        ordinal       INTEGER NOT NULL,
        start_sec     REAL NOT NULL,
        end_sec       REAL NOT NULL,
        text          TEXT NOT NULL,
        speaker_label TEXT,
        speaker_id    TEXT,
        created_at    TEXT NOT NULL,
        UNIQUE(meeting_id, ordinal)
      );
      CREATE INDEX IF NOT EXISTS idx_transcript_segments_meeting ON transcript_segments(meeting_id);
    `
  }
];

// ─── Seed defaults ───────────────────────────────────────────

function seedDefaults(db: Database.Database): void {
  // Default root folder
  db.prepare(`
    INSERT OR IGNORE INTO folders (id, name, path, parent_id, default_tags, created_at, updated_at, synced)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Raiz', '/', NULL, '{}', datetime('now'), datetime('now'), 1)
  `).run();
}
