# API Surface

> Base: `/api/v1`  Port (local): `8087`

## Health

| Method | Path | Notes |
|--------|------|-------|
| GET | `/actuator/health` | Spring Boot health check |
| GET | `/api/v1/health` | App-level ping |
| GET | `/api/v1/debug/info` | Build + env summary (non-prod) |

## Meetings

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/meetings` | Create; returns `{id}` |
| GET | `/api/v1/meetings/{id}` | Full meeting + transcript + summary |
| GET | `/api/v1/meetings` | List all (paginated) |
| PATCH | `/api/v1/meetings/{id}/title` | `{"title":"…"}` |
| POST | `/api/v1/meetings/{id}/audio` | Multipart upload; respects `AUTO_TRANSCRIBE_ON_UPLOAD` |
| POST | `/api/v1/meetings/{id}/transcribe` | Manual transcription trigger |

## Desktop Queue (PR05)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/desktop/queue/{meetingId}` | Enqueue job |
| GET | `/api/v1/desktop/queue` | List pending jobs |
| POST | `/api/v1/desktop/queue/{id}/accept` | Lock job for this device |
| POST | `/api/v1/desktop/queue/{id}/transcript` | Post completed transcript |
| POST | `/api/v1/desktop/queue/{id}/fail` | Report failure |
| DELETE | `/api/v1/desktop/queue/{id}` | Cancel job |

## Folders (PR07)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/folders` | Tree of all folders |
| POST | `/api/v1/folders` | `{name, parentId?}` |
| GET | `/api/v1/folders/{id}` | Single folder |
| PUT | `/api/v1/folders/{id}` | Rename / reparent |
| DELETE | `/api/v1/folders/{id}` | Cascades to sub-folders |

## Meeting Types (PR07)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/meeting-types` | List all |
| POST | `/api/v1/meeting-types` | Create |
| GET | `/api/v1/meeting-types/{id}` | Single |
| PUT | `/api/v1/meeting-types/{id}` | Update |
| DELETE | `/api/v1/meeting-types/{id}` | Delete |

## People (PR08)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/people` | List; `?q=` for @mention search |
| POST | `/api/v1/people` | Create |
| GET | `/api/v1/people/{id}` | Single |
| PUT | `/api/v1/people/{id}` | Update |
| DELETE | `/api/v1/people/{id}` | Soft-delete / remove |

## Meeting People (PR08)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/meetings/{id}/people` | List participants + mentioned |
| POST | `/api/v1/meetings/{id}/people` | Add person (`{personId, role}`) |
| DELETE | `/api/v1/meetings/{id}/people/{personId}` | Remove from meeting |

## Summary Templates (PR09)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/summary-templates` | List all |
| POST | `/api/v1/summary-templates` | Create |
| GET | `/api/v1/summary-templates/{id}` | Single |
| PUT | `/api/v1/summary-templates/{id}` | Update |
| DELETE | `/api/v1/summary-templates/{id}` | Delete |
| POST | `/api/v1/meetings/{id}/summaries` | Generate summary via GPT |

## Meeting Notes (PR-Notes)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/meetings/{id}/notes` | All three phases (agenda, live, post) |
| PATCH | `/api/v1/meetings/{id}/notes/agenda` | Pre-meeting agenda |
| PATCH | `/api/v1/meetings/{id}/notes/live` | During-meeting notes |
| PATCH | `/api/v1/meetings/{id}/notes/post` | Post-meeting recap |
| GET | `/api/v1/meetings/{id}/notes/action-items` | Extracted ACTION ITEMS blocks |
| GET | `/api/v1/meetings/{id}/notes/decisions` | Extracted DECISIONS blocks |
| POST | `/api/v1/meetings/{id}/notes/link-previous` | Link to previous meeting |
| GET | `/api/v1/meetings/{id}/notes/previous-context` | Continuity context |
| GET | `/api/v1/meetings/{id}/notes/gpt-context` | Formatted context for GPT |\
| POST | `/api/v1/meetings/{id}/notes/import` | Import transcript file (VTT/TXT/DOCX) |

## Meeting Series (PR-Notes)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/meeting-series` | List all series |
| POST | `/api/v1/meeting-series` | Create series |
| GET | `/api/v1/meeting-series/{id}` | Series + entry list |
| PATCH | `/api/v1/meeting-series/{id}` | Update name/description |
| DELETE | `/api/v1/meeting-series/{id}` | Delete |
| GET | `/api/v1/meeting-series/{id}/meetings` | Meetings in series (ordered) |
| POST | `/api/v1/meeting-series/{id}/meetings` | Add meeting to series |

## User Preferences (PR-Notes)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/preferences/{userKey}` | Get preferences JSON |
| PATCH | `/api/v1/preferences/{userKey}` | Partial update |
