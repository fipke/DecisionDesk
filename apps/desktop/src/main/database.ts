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
  },
  {
    name: '013_summary_templates_columns',
    sql: `
      ALTER TABLE templates ADD COLUMN description TEXT DEFAULT '';
      ALTER TABLE templates ADD COLUMN system_prompt TEXT DEFAULT '';
      ALTER TABLE templates ADD COLUMN user_prompt_template TEXT DEFAULT '';
      ALTER TABLE templates ADD COLUMN output_format TEXT DEFAULT 'markdown';
      ALTER TABLE templates ADD COLUMN model TEXT DEFAULT 'qwen3:14b';
      ALTER TABLE templates ADD COLUMN max_tokens INTEGER DEFAULT 2000;
      ALTER TABLE templates ADD COLUMN temperature REAL DEFAULT 0.3;
      ALTER TABLE templates ADD COLUMN is_default INTEGER DEFAULT 0;
    `
  },
  {
    name: '014_summary_snippet',
    sql: `ALTER TABLE meetings ADD COLUMN summary_snippet TEXT;`
  },
  {
    name: '015_action_items',
    sql: `
      CREATE TABLE IF NOT EXISTS action_items (
        id              TEXT PRIMARY KEY NOT NULL,
        meeting_id      TEXT NOT NULL,
        series_id       TEXT,
        content         TEXT NOT NULL,
        assignee_name   TEXT,
        assignee_id     TEXT,
        due_date        TEXT,
        status          TEXT NOT NULL DEFAULT 'open',
        resolved_at     TEXT,
        resolved_in_meeting_id TEXT,
        ordinal         INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_action_items_series ON action_items(series_id);
      CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
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

  // Default summary templates (matching backend V4 migration)
  const templateCount = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as any)?.c ?? 0;
  if (templateCount === 0) {
    const ts = new Date().toISOString();
    const insertTemplate = db.prepare(`
      INSERT OR IGNORE INTO templates (id, name, body_markdown, description, system_prompt, user_prompt_template, output_format, model, max_tokens, temperature, is_default, created_at, updated_at)
      VALUES (?, ?, '', ?, ?, ?, 'markdown', 'qwen3:14b', 2000, 0.3, ?, ?, ?)
    `);
    insertTemplate.run(
      '00000000-0000-0000-0000-000000000010',
      'Resumo Executivo',
      'Resumo conciso para reuniões gerais',
      'Você é um assistente especializado em criar resumos executivos de reuniões.\nSeja conciso, objetivo e destaque os pontos principais.\nResponda sempre em português brasileiro.',
      'Analise a transcrição da reunião abaixo e crie um resumo executivo com as seguintes seções:\n\n## Resumo\n(2-3 frases resumindo a reunião)\n\n## Principais Pontos Discutidos\n(lista com bullet points)\n\n## Decisões Tomadas\n(lista de decisões, se houver)\n\n## Próximos Passos / Action Items\n(lista de tarefas com responsáveis se mencionados)\n\n## Participantes Mencionados\n(lista de pessoas mencionadas)\n\n---\nTRANSCRIÇÃO:\n{{transcript}}',
      1, ts, ts
    );
    insertTemplate.run(
      '00000000-0000-0000-0000-000000000011',
      'Ata de Reunião Formal',
      'Formato de ata corporativa detalhada',
      'Você é um assistente especializado em criar atas de reunião formais e profissionais.\nUse linguagem corporativa e formal.\nResponda sempre em português brasileiro.',
      'Crie uma ata de reunião formal baseada na transcrição abaixo:\n\n# ATA DE REUNIÃO\n\n**Data:** [extrair da transcrição ou informar "não especificado"]\n**Participantes:** [listar participantes mencionados]\n\n## 1. Pauta / Assuntos Tratados\n\n[Descrever cada tópico discutido em detalhes]\n\n## 2. Deliberações\n\n[Decisões tomadas durante a reunião]\n\n## 3. Encaminhamentos\n\n| Ação | Responsável | Prazo |\n|------|-------------|-------|\n[tabela de action items]\n\n## 4. Observações Gerais\n\n[Outras informações relevantes]\n\n---\nTRANSCRIÇÃO:\n{{transcript}}',
      0, ts, ts
    );
    insertTemplate.run(
      '00000000-0000-0000-0000-000000000012',
      'Resumo Técnico',
      'Para reuniões técnicas com foco em decisões de arquitetura/código',
      'Você é um arquiteto de software sênior criando resumos de reuniões técnicas.\nFoque em decisões técnicas, trade-offs discutidos e próximos passos de implementação.\nResponda sempre em português brasileiro.',
      'Analise esta reunião técnica e crie um resumo focado em software:\n\n## Contexto\n(qual problema ou feature está sendo discutido)\n\n## Decisões de Arquitetura\n(decisões técnicas tomadas, com justificativas)\n\n## Trade-offs Considerados\n(alternativas discutidas e porque foram descartadas)\n\n## Tasks Técnicas\n- [ ] (lista de tarefas de implementação)\n\n## Dependências / Blockers\n(se mencionados)\n\n## Tech Stack / Ferramentas Mencionadas\n(tecnologias, bibliotecas, serviços)\n\n---\nTRANSCRIÇÃO:\n{{transcript}}',
      0, ts, ts
    );
  }
}
