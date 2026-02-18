# PR03 — iOS v1 ✅

**Scope**: Mobile (React Native / Expo)  
**Status**: Complete

## What was built

### Core flow
1. User opens `RecordScreen`, taps record → captures AAC 48 kHz mono ~96 kbps
2. App creates a meeting locally (SQLite, status `PENDING_SYNC`) and uploads audio to backend
3. User taps **Transcrever agora** → calls `POST /meetings/{id}/transcribe`
4. `MeetingDetailScreen` polls status; once `DONE`, shows transcript + cost breakdown

### Screens
| Screen | Path | Description |
|--------|------|-------------|
| Meeting List | `MeetingListScreen.tsx` | Folder-organised list; swipe actions |
| Meeting Detail | `MeetingDetailScreen.tsx` | Transcript, cost, notes, people, summary |
| Record | `RecordScreen.tsx` | Mic recording, upload, manual transcribe trigger |
| Settings | `SettingsScreen.tsx` | API URL, transcription provider, Wi-Fi/cellular toggle |

### Offline-first (SQLite)
- `apps/mobile/src/storage/database.ts` — expo-sqlite, WAL mode
- Tables: `meetings`, `folders`, `meeting_types`, `people`, `meeting_people`, `sync_queue`
- Outbox sync: pending mutations enqueued, drained when online

### Network policy
- Wi-Fi by default; cellular upload requires explicit opt-in in Settings
- API URL configurable (defaults to `http://localhost:8087`)

### Key dependencies
- `expo-av` — audio recording
- `expo-sqlite` — local persistence
- `@tanstack/react-query` — server state + polling
- `zustand` — local state
- `nativewind` — Tailwind styling
