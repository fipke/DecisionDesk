# PR07 — Organisation (Folders, Types, Tags) ✅

**Scope**: Backend + Mobile  
**Status**: Complete — commit `5f666f8f`

## What was built

### Database — `V2__folders_types_tags.sql`

**`folders`**
```
id                UUID PK
name              TEXT NOT NULL
path              TEXT NOT NULL UNIQUE   -- e.g. "/Clientes/Acme"
parent_id         UUID FK (self)
default_tags      JSONB DEFAULT '{}'
default_whisper_model TEXT
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ
```
Root folder `"/"` seeded automatically.

**`meeting_types`**
```
id                UUID PK
name              TEXT UNIQUE
description       TEXT
required_tags     JSONB DEFAULT '{}'
default_whisper_model TEXT
created_at        TIMESTAMPTZ
```

**`meetings` additions**
```
folder_id         UUID FK → folders
meeting_type_id   UUID FK → meeting_types
tags              JSONB DEFAULT '{}'
title             TEXT
updated_at        TIMESTAMPTZ
```

### API

**Folders — `FoldersController`**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/folders` | List all folders (ordered by path) |
| `POST` | `/api/v1/folders` | Create folder |
| `GET` | `/api/v1/folders/{id}` | Get folder |
| `PATCH` | `/api/v1/folders/{id}` | Update folder |
| `DELETE` | `/api/v1/folders/{id}` | Delete folder |

**Meeting Types — `MeetingTypesController`**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/meeting-types` | List all types |
| `POST` | `/api/v1/meeting-types` | Create type |
| `GET` | `/api/v1/meeting-types/{id}` | Get type |
| `PATCH` | `/api/v1/meeting-types/{id}` | Update type |
| `DELETE` | `/api/v1/meeting-types/{id}` | Delete type |

**Meetings patch** — `PATCH /api/v1/meetings/{id}` accepts `folderId`, `meetingTypeId`, `tags`, `title`

### Mobile integration
- `FolderService` + local SQLite table `folders`
- `MeetingListScreen` groups meetings by folder
- Folder picker and type picker in meeting creation flow
- Tags displayed as chips on meeting detail
