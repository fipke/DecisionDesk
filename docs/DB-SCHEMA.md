# DB Schema — PostgreSQL (Flyway Migrations)

> Authoritative: `apps/backend/src/main/resources/db/migration/`  
> All tables use UUID primary keys unless noted.

## V1 — Baseline

| Table | Key Columns |
|-------|-------------|
| `meetings` | `id` UUID PK, `status` (`NEW`\|`PROCESSING`\|`DONE`\|`ERROR`), `title`, `folder_id`, `meeting_type_id`, `tags` JSONB, `created_at`, `updated_at` |
| `audio_assets` | `id`, `meeting_id` FK, `path`, `codec`, `sample_rate`, `size_bytes`, `duration_sec` |
| `transcripts` | `id`, `meeting_id` FK UNIQUE, `language` (default `pt`), `text`, `provider`, `created_at` |
| `summaries` | `id`, `meeting_id` FK UNIQUE, `text_md`, `template_id` FK, `model`, `tokens_used`, `updated_at` |
| `usage_records` | `id`, `meeting_id` FK, `service` (`WHISPER`\|`GPT`), `units`, `usd`, `brl`, `meta` JSONB |

## V2 — Folders, Types, Tags

| Table | Key Columns |
|-------|-------------|
| `folders` | `id`, `name`, `path` UNIQUE, `parent_id` FK self-ref, `default_tags` JSONB, `default_whisper_model`, `summary_template_id` |
| `meeting_types` | `id`, `name` UNIQUE, `description`, `required_tags` JSONB, `default_whisper_model`, `summary_template_id` |

`meetings` gets: `folder_id`, `meeting_type_id`, `tags` JSONB, `title`, `updated_at`.

Default root folder seeded: `id=00000000-0000-0000-0000-000000000001`, `path=/`.

## V3 — People

| Table | Key Columns |
|-------|-------------|
| `people` | `id`, `display_name` (≤50 chars, used for @mentions), `full_name`, `email`, `notes` |
| `meeting_people` | PK (`meeting_id`, `person_id`, `role`), `role` (`participant`\|`mentioned`) |

## V4 — Summary Templates

| Table | Key Columns |
|-------|-------------|
| `summary_templates` | `id`, `name`, `system_prompt`, `user_prompt_template` (with `{{transcript}}` placeholder), `output_format`, `model`, `max_tokens`, `temperature`, `is_default` |

Two templates seeded: `00000000-…0010` (Resumo Executivo) and `00000000-…0011` (Notas de Reunião).

## V5 — Notes & Continuity

| Table | Key Columns |
|-------|-------------|
| `meeting_notes` | `id`, `meeting_id` FK UNIQUE, `agenda_md`, `live_notes_md`, `post_notes_md`, `updated_at` |
| `meeting_continuity` | `id`, `meeting_id`, `previous_meeting_id`, link type |
| `meeting_series` | `id`, `name`, `description`, `recurrence_rule` |
| `meeting_series_entries` | PK (`series_id`, `meeting_id`), `sequence_number` |
| `user_preferences` | `id`, `user_key` UNIQUE, `preferences` JSONB |

## V6 — Transcription Queue

| Table | Key Columns |
|-------|-------------|
| `transcription_queue` | `id`, `meeting_id` FK, `status` (`PENDING`\|`ACCEPTED`\|`PROCESSING`\|`COMPLETED`\|`FAILED`\|`CANCELLED`), `device_id`, `model`, `language`, `retry_count`, `error_message`, `locked_at`, `completed_at` |

Auto-updated `updated_at` trigger included.

## V7 — Soft Deletes

`meetings` gets: `deleted_at` TIMESTAMPTZ (null = active).
Partial index: `idx_meetings_deleted_at` WHERE `deleted_at IS NULL`.

## V8 — Multi-Summary + Meeting Type Enrichment

**Summaries**: Drops unique `meeting_id` constraint. New composite indexes:
- `idx_summaries_meeting_template` UNIQUE on `(meeting_id, template_id)` WHERE `template_id IS NOT NULL`
- `idx_summaries_meeting_default` UNIQUE on `(meeting_id)` WHERE `template_id IS NULL`

**meeting_types** gets: `summary_template_ids` UUID[], `extraction_config` JSONB, `ai_provider` VARCHAR(20), `default_participants` UUID[], `icon`, `color`.

**summary_templates** gets: `extraction_config` JSONB (overrides meeting_type when set).

**user_preferences** gets: `ai_config` JSONB (per-task AI provider/model settings).

Seed data: "Acompanhamento Semanal" template + "Reuniao Ray (PowerBI)" meeting type.

## Indexes of note

- `meetings`: GIN on `tags`; btree on `folder_id`, `meeting_type_id`
- `folders`: btree on `path`, `parent_id`
- `people`: btree on `display_name` (case-insensitive variant)
- `transcription_queue`: btree on `status`, `meeting_id`, `created_at`
