# PR-Notes — Meeting Notes System ✅

**Scope**: Backend  
**Status**: Complete — commit `e24f8f7f`, tests `31d38742`

## What was built

### Database — `V5__notes_continuity.sql`

**`meeting_notes`** — structured block model
```
id             UUID PK
meeting_id     UUID FK → meetings
phase          TEXT  -- 'agenda' | 'live' | 'post'
ordinal        INT
block_type     TEXT  -- 'heading' | 'paragraph' | 'action_item' | 'decision' | 'question' | 'reference'
content        TEXT
checked        BOOLEAN DEFAULT false
speaker_label  TEXT
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
```

**`meeting_continuity`** — links consecutive meetings in a series
```
meeting_id          UUID FK → meetings (the current meeting)
previous_meeting_id UUID FK → meetings
linked_at           TIMESTAMPTZ
```

**`meeting_series`** — recurring meeting groups
```
id              UUID PK
name            TEXT
rrule           TEXT   -- iCal RRULE (optional)
folder_id       UUID FK → folders
meeting_type_id UUID FK → meeting_types
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

**`meeting_series_entries`**
```
meeting_id   UUID FK → meetings
series_id    UUID FK → meeting_series
ordinal      INT
PRIMARY KEY (meeting_id, series_id)
```

**`user_preferences`**
```
user_id           TEXT PK
default_language  TEXT DEFAULT 'pt'
default_template_id UUID FK → summary_templates
updated_at        TIMESTAMPTZ
```

### API

**Notes — `MeetingNotesController`**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/meetings/{id}/notes` | All note blocks (all phases) |
| `PATCH` | `/api/v1/meetings/{id}/notes/agenda` | Upsert agenda blocks (pre-meeting) |
| `PATCH` | `/api/v1/meetings/{id}/notes/live` | Upsert live blocks (during meeting) |
| `PATCH` | `/api/v1/meetings/{id}/notes/post` | Upsert post-meeting blocks |
| `GET` | `/api/v1/meetings/{id}/notes/action-items` | Extract `action_item` blocks |
| `GET` | `/api/v1/meetings/{id}/notes/decisions` | Extract `decision` blocks |
| `POST` | `/api/v1/meetings/{id}/notes/link-previous` | Link to previous meeting (`meeting_continuity`) |
| `GET` | `/api/v1/meetings/{id}/notes/previous-context` | Summary of previous meeting's actions/decisions |
| `GET` | `/api/v1/meetings/{id}/notes/gpt-context` | Formatted context blob for GPT prompt |

**Series — `MeetingSeriesController`**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/meeting-series` | List all series |
| `POST` | `/api/v1/meeting-series` | Create series |
| `GET` | `/api/v1/meeting-series/{id}` | Get series |
| `PATCH` | `/api/v1/meeting-series/{id}` | Update series |
| `DELETE` | `/api/v1/meeting-series/{id}` | Delete series |
| `GET` | `/api/v1/meeting-series/{id}/meetings` | Ordered meeting list |
| `POST` | `/api/v1/meeting-series/{id}/meetings` | Add meeting to series |

**Transcript Import — `TranscriptImportController`**
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/import/file` | Parse Teams/Zoom `.vtt`, `.txt`, `.docx` → note blocks |
| `POST` | `/api/v1/import/text` | Parse raw plain text → note blocks |

**User Preferences — `UserPreferencesController`**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/preferences/{userId}` | Get language + default template |
| `PATCH` | `/api/v1/preferences/{userId}` | Update preferences |

### Block types
| Type | Description | Has checkbox |
|------|-------------|-------------|
| `heading` | Section header | No |
| `paragraph` | Free text | No |
| `action_item` | Task / pending | ✅ Yes |
| `decision` | Recorded decision | No |
| `question` | Open question | No |
| `reference` | Linked document or URL | No |

### Continuity flow
When a recurring meeting starts, the UI can call `link-previous` to attach the previous occurrence, then `previous-context` to prefill the agenda with unresolved action items from the last meeting.
