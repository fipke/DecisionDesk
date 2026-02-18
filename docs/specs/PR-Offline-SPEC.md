# PR-Offline — Desktop Offline-First Architecture ✅

**Scope**: Desktop (Electron main process + renderer)  
**Status**: Complete — uncommitted working tree (pending commit)

## What was built

### Dependencies added (`apps/desktop/package.json`)
- `better-sqlite3` + `@types/better-sqlite3` — synchronous SQLite in main process
- `uuid` + `@types/uuid` — local ID generation without backend round-trip

### New files

#### `src/shared/types.ts`
Single source of truth for all entity TypeScript interfaces used by both main process and renderer:
- `Meeting`, `Folder`, `MeetingType`, `Person`, `MeetingPerson`
- `NoteBlock`, `Summary`, `MeetingSeries`, `MeetingSeriesEntry`, `Template`
- `SyncQueueItem`, `Settings`, `PendingJob`, `AcceptedJob`

#### `src/main/database.ts`
- Opens `{userData}/data/decisiondesk.db` with WAL mode + `NORMAL` sync + 5 s busy timeout
- Runs 10 sequential migrations on startup (idempotent via `_migrations` table)
- Seeds default root folder `"/"` on first launch

**Migration table summary**
| # | Name | Tables created |
|---|------|---------------|
| 001 | meetings | `meetings` |
| 002 | folders | `folders` |
| 003 | meeting_types | `meeting_types` |
| 004 | people | `people` |
| 005 | meeting_people | `meeting_people` |
| 006 | note_blocks | `note_blocks` |
| 007 | summaries | `summaries` |
| 008 | series | `meeting_series`, `meeting_series_entries` |
| 009 | templates | `templates` |
| 010 | sync_queue | `sync_queue` |

#### `src/main/repositories.ts`
Full synchronous CRUD for all entities. Every mutating operation (upsert/delete) **automatically enqueues** a `sync_queue` row.

| Entity | Operations |
|--------|-----------|
| Meetings | listMeetings, listMeetingsByFolder, getMeeting, upsertMeeting, deleteMeeting |
| Folders | listFolders, getFolder, upsertFolder, deleteFolder |
| Meeting Types | listMeetingTypes, getMeetingType, upsertMeetingType |
| People | listPeople, getPerson, upsertPerson, deletePerson |
| Meeting People | listMeetingPeople, addMeetingPerson, removeMeetingPerson |
| Note Blocks | listNoteBlocks, upsertNoteBlock, deleteNoteBlock |
| Summaries | listSummaries, upsertSummary |
| Meeting Series | listMeetingSeries, upsertMeetingSeries, listSeriesEntries, addSeriesEntry |
| Templates | listTemplates, upsertTemplate, deleteTemplate |
| Sync Queue | listSyncQueue, syncQueueCount, removeSyncItem, markSyncItemFailed |

#### `src/main/connectivity.ts` — `ConnectivityService`
- Extends `EventEmitter`
- Uses `net.isOnline()` + `net.fetch` health check (`GET /health`, 5 s timeout) every 15 s
- Emits: `online`, `offline`, `backend-reachable`, `backend-unreachable`, `status`
- Status forwarded to renderer via `connectivity:status-changed` IPC event

#### `src/main/syncService.ts` — `SyncService`
- Auto-drains outbox when `ConnectivityService` emits `backend-reachable`
- Processes `sync_queue` rows FIFO: CREATE / UPDATE → PUT to backend; DELETE → DELETE to backend
- Handles: meetings, folders, people, note_blocks, summaries, templates, meeting_people, meeting_series
- Max 5 retries; permanently failed items skipped (manual retry later)
- Returns `{ synced, failed }` count

### Modified files

#### `src/main/api.ts`
Added sync push methods:
- `syncMeeting`, `deleteMeeting`, `syncFolder`, `deleteFolder`
- `syncPerson`, `deletePerson`, `syncNoteBlock`, `deleteNoteBlock`
- `syncSummary`, `syncTemplate`, `deleteTemplate`
- `syncMeetingPerson`, `deleteMeetingPerson`, `syncMeetingSeries`
- `fetchAllMeetings`, `fetchAllFolders`, `fetchAllPeople` (Phase 2 pull)

#### `src/preload/index.ts`
Typed IPC bridge rewritten with two new namespaces:

**`db.*`** — 30+ handlers for all entity CRUD + `syncQueueCount`, `triggerSync`  
**`connectivity.*`** — `getStatus()`, `onStatusChange(callback)`

All types imported from `src/shared/types.ts`.

#### `src/main/index.ts`
- `initDatabase()` called before any other service
- `ConnectivityService` + `SyncService` wired and started
- API URL changes propagate to both `ApiService` and `ConnectivityService`
- `closeDatabase()` called on `window-all-closed`
- 40+ `ipcMain.handle` registrations

#### `src/renderer/App.tsx`
Sidebar additions:
- Connectivity status dot: 🟢 backend connected / 🟡 online but backend unreachable / 🔴 no connection
- Pending sync badge showing count from `syncQueueCount` (refreshes every 5 s)

#### `electron.vite.config.ts`
Changed `externalizeDepsPlugin({ exclude: ['electron-store'] })` → `externalizeDepsPlugin()` so `better-sqlite3` (native module) is correctly externalised.

## Sync pattern details

```
[User action in renderer]
       ↓
  ipcRenderer.invoke('db:meetings:upsert', data)
       ↓
  repositories.upsertMeeting(data)       ← writes to SQLite
       ↓
  enqueue('meetings', id, 'UPDATE', row) ← writes to sync_queue
       ↓  (when backendReachable)
  SyncService.drain()
       ↓
  ApiService.syncMeeting(payload)        ← PUT /api/v1/meetings/{id}
       ↓
  removeSyncItem(id)                     ← removes from sync_queue
```

Conflict resolution: **last-writer-wins** via `updated_at`. The backend accepts the desktop payload unconditionally in this phase; bidirectional pull (Phase 2) will add server-wins reconciliation.
