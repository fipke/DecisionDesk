# DB Schema — Local (SQLite)

> Used by iOS (`expo-sqlite`) and macOS desktop (`better-sqlite3` WAL mode).  
> Mirrors the server schema but is intentionally minimal — only what offline use requires.

## iOS (expo-sqlite)

| Table | Notes |
|-------|-------|
| `meetings` | `id`, `title`, `status`, `folder_id`, `created_at`, `synced` flag |
| `audio_assets` | local file path, `meeting_id`, codec, duration |
| `transcripts` | `meeting_id`, `text`, `language`, `synced` |
| `folders` | mirrors server `folders`; cached for offline folder picker |
| `meeting_types` | cached for offline type picker |
| `sync_queue` | pending ops: `op` (`CREATE`/`UPDATE`/`DELETE`), `entity`, `payload` JSON, `retries` |

## macOS Desktop (better-sqlite3)

> Schema lives in `apps/desktop/src/main/database.ts` (WAL + foreign keys enabled).

| Table | Notes |
|-------|-------|
| `meetings` | full mirror of server columns |
| `audio_assets` | local `file_path`, `synced` |
| `transcripts` | `meeting_id`, `text`, `provider`, `synced` |
| `transcription_jobs` | local queue: `id`, `meeting_id`, `status`, `model`, `language`, `created_at` |
| `folders` | cached |
| `people` | cached for @mention autocomplete |
| `summary_templates` | cached |
| `sync_log` | op log for `SyncService` retry logic |

## Sync Policy

- Offline writes land in local tables first.
- `SyncService` (desktop) / `syncQueue` (iOS) drains when connectivity returns.
- Server is always the source of truth for resolved conflicts; last-write-wins on title/notes.
- Audio files are held locally until confirmed uploaded.
