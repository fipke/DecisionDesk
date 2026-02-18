# DecisionDesk — Modern UI/UX Full Redesign Design

**Date:** 2026-02-18
**Scope:** Mobile (priority) → Desktop expansion → Web app (PR10)
**Reference apps:** Granola AI, MacWhisper
**Status:** Approved ✅

---

## Context

The backend is feature-complete (PR01–PR-Offline): 13 controllers, 27 services, 6 DB migrations, all APIs for meetings, transcripts, notes, summaries, people, folders, and desktop queue are fully implemented.

The client apps are a raw MVP:

| Client | Current state | Gap |
|--------|--------------|-----|
| Mobile (iOS) | 5 screens, functional recording/upload/transcription | Basic UX, no notes/people/folder UI, no search |
| Desktop (macOS) | 2 screens (Queue + Settings only) | Missing entire meeting management layer |
| Web | README stub only | Does not exist |

**Goal:** Redesign all three client surfaces to feel like a premium, modern meeting recorder — Granola-style Transcript/Notes/Summary split view, live waveform on record, in-meeting note pad, notes-driven transcript search. Mobile is the design reference; desktop and web follow the same design language.

---

## Design System

Shared across all three clients. No new library — extend existing Tailwind / NativeWind tokens.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Background | `slate-950` #020617 | App chrome, screen backgrounds |
| Surface | `slate-900` #0f172a | Cards, panels |
| Border | `slate-800` #1e293b | Card borders, dividers |
| Muted text | `slate-400` #94a3b8 | Labels, placeholders |
| Primary text | `slate-100` #f1f5f9 | Body copy, headings |
| Accent | `emerald-500` | Buttons, active states, speaker names |
| Danger | `red-500` | Stop recording, delete |
| Warning | `amber-400` | Pending sync badge |

### Typography

- Headers: `font-semibold` (600 weight)
- Body: `text-sm leading-relaxed`
- Timestamps / IDs: `font-mono text-xs`

### Shared Tokens

- Cards: `rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4`
- Buttons: `rounded-lg`
- Tab bar height: 49pt (mobile), 40px (web/desktop)

---

## Phase 1 — packages/

### `packages/types/src/index.ts` (full rewrite from stub)

New interfaces to add:

```typescript
// Meetings
interface Meeting { id: string; title?: string; status: MeetingStatus; createdAt: ISODate; durationSec?: number; costBrl?: number; costUsd?: number; folderId?: string; meetingTypeId?: string; tags?: Record<string, string>; transcriptText?: string; summary?: string; }
type MeetingStatus = 'NEW' | 'PROCESSING' | 'DONE' | 'ERROR';

// Transcript
interface TranscriptLine { speaker?: string; startSec?: number; endSec?: number; text: string; }
interface Transcript { meetingId: string; lines: TranscriptLine[]; rawText: string; provider: string; language: string; }

// Notes
interface MeetingNotes { agendaMd?: string; liveNotesMd?: string; postNotesMd?: string; }
interface ActionItem { text: string; assignee?: string; completed: boolean; }
interface Decision { text: string; }

// People
interface Person { id: string; displayName: string; fullName?: string; email?: string; }
interface MeetingPerson { personId: string; role: 'participant' | 'mentioned'; }

// Organisation
interface Folder { id: string; name: string; path: string; parentId?: string; }
interface MeetingType { id: string; name: string; description?: string; }

// Summaries
interface Summary { id: string; meetingId: string; textMd: string; model: string; templateId?: string; }
interface SummaryTemplate { id: string; name: string; isDefault: boolean; }

// Queue
type QueueJobStatus = 'PENDING' | 'ACCEPTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
interface QueueJob { id: string; meetingId: string; status: QueueJobStatus; model: string; language: string; diarization: boolean; errorMessage?: string; }

// Connectivity
interface ConnectivityStatus { online: boolean; backendReachable: boolean; }

// Highlight
interface HighlightSegment { text: string; highlighted: boolean; }
```

### `packages/utils/src/index.ts` (expand from single function)

New utilities:

```typescript
formatDuration(ms: number): string              // 270000 → "04:30"
formatDurationSec(sec: number): string          // 270 → "04:30"
formatRelativeDate(iso: string): string         // "Hoje", "Ontem", "18 fev"
groupByDate<T>(items: T[], getDate: (t: T) => string): Record<string, T[]>
extractSpeakers(lines: TranscriptLine[]): string[]
highlightMatches(text: string, query: string): HighlightSegment[]
parseSpeakerLine(raw: string): TranscriptLine | null  // "00:01 John: Hello"
toBRL(amount: number): string                    // existing — keep
```

---

## Phase 2 — Mobile Redesign (Priority)

### Screen Map

| Screen | Status | Core change |
|--------|--------|-------------|
| `MeetingListScreen` | Redesign | Search bar, date-grouped `SectionList`, richer `MeetingCard` |
| `RecordScreen` | Redesign | `WaveformView` animation, slide-up `InMeetingNotesPad` |
| `MeetingDetailScreen` | Redesign | 3-tab: Transcript / Notas / Resumo |
| `SettingsScreen` | Enhance | Transcription prefs, people link, language |
| `SearchScreen` | New | Full-text search across meetings |
| `FolderScreen` | New | Collapsible folder tree |
| `PeopleScreen` | New | Participant directory with @mention search |

### New Components

| Component | File | Description |
|-----------|------|-------------|
| `WaveformView` | `components/WaveformView.tsx` | 30 animated emerald bars, driven by `durationMillis` |
| `InMeetingNotesPad` | `components/InMeetingNotesPad.tsx` | Half-screen bottom sheet, plain text editor for `live_notes` |
| `TabBar` | `components/TabBar.tsx` | 3-tab switcher, highlight active |
| `TranscriptView` | `components/TranscriptView.tsx` | Speaker-labeled lines, timestamps, keyword highlight |
| `AINotesView` | `components/AINotesView.tsx` | Granola-style: editable notes + parsed Action Items + Decisions |
| `SummaryView` | `components/SummaryView.tsx` | Markdown render of GPT summary + "Gerar Resumo" button |
| `SearchBar` | `components/SearchBar.tsx` | Controlled input with debounce |
| `MeetingCard` | `components/MeetingCard.tsx` | Replaces `MeetingListItem` — title + date + duration + badge + cost |
| `FolderBreadcrumb` | `components/FolderBreadcrumb.tsx` | Horizontal path above the list |
| `ParticipantRow` | `components/ParticipantRow.tsx` | Avatar circle + name + role |
| `ActionItemRow` | `components/ActionItemRow.tsx` | Checkbox + assignee @mention |
| `EmptyState` | `components/EmptyState.tsx` | Icon + title + subtitle reusable empty state |

### New State / Services

| File | Purpose |
|------|---------|
| `state/NotesContext.tsx` | Meeting notes (agenda, live, post) + save/load |
| `state/FolderContext.tsx` | Active folder, folder tree |
| `state/PeopleContext.tsx` | People list, search |
| `services/notesService.ts` | `GET/PATCH /api/v1/meetings/{id}/notes` |
| `services/peopleService.ts` | `GET/POST /api/v1/people` and `/meetings/{id}/people` |
| `services/folderService.ts` | `GET /api/v1/folders` |

### Screen Details

#### `MeetingListScreen` (redesign)

```
┌──────────────────────────────────────────┐
│ 📁  Reuniões          [📁] [⚙️]         │  ← header icons
│ ┌──────────────────────────────────────┐ │
│ │  🔍 Buscar…                          │ │  ← SearchBar (navigates to SearchScreen)
│ └──────────────────────────────────────┘ │
│  Work / Q3  >                            │  ← FolderBreadcrumb
│                                          │
│  HOJE                                    │  ← SectionList section header
│ ┌──────────────────────────────────────┐ │
│ │ Q3 Planning          14:00    ✅ Done │ │  ← MeetingCard
│ │ 45m  ·  R$0,43                       │ │
│ └──────────────────────────────────────┘ │
│  ONTEM                                   │
│ ┌──────────────────────────────────────┐ │
│ │ Team Standup         09:15   ⏳ Proc. │ │
│ │ 23m  ·  —                            │ │
│ └──────────────────────────────────────┘ │
│                                          │
│                              ⊕           │  ← FAB bottom-right
└──────────────────────────────────────────┘
```

Key: `SectionList` (not `FlatList`), pull-to-refresh, swipe-left → delete.

#### `RecordScreen` (redesign)

```
┌──────────────────────────────────────────┐
│ ← Nova gravação                    📝   │  ← FAB opens InMeetingNotesPad
│                                          │
│                                          │
│  ▌▃▅▇█▆▄▃▂▄▆█▇▅▃▌▃▅▇█▆▄▃▂▄▆█▇▅      │  ← WaveformView (animated)
│                                          │
│           00:04:32                       │  ← text-5xl font-bold
│           Gravando…  ●                   │  ← pulsing dot
│                                          │
│  ┌────────────────────────────────────┐  │
│  │         ◼  Parar e salvar          │  │  ← danger button
│  └────────────────────────────────────┘  │
│                                          │
│  Arquivos salvos localmente até sync     │  ← footnote
└──────────────────────────────────────────┘
```

`InMeetingNotesPad` (bottom sheet, half-screen):
- Title: "Anotações da reunião"
- `TextInput` multiline, auto-focus, `returnKeyType="done"`
- "Salvar" button → saves text; closes sheet; text carried to `live_notes` on stop

#### `MeetingDetailScreen` (redesign)

```
┌──────────────────────────────────────────┐
│ ← Q3 Planning                      ⋯   │
│   18 fev 2026  ·  45m                   │
│   👤 João  👤 Maria  👤 Carlos          │
│ ┌──────────────┬────────────┬──────────┐ │
│ │ Transcrição  │   Notas    │  Resumo  │ │  ← TabBar
│ └──────────────┴────────────┴──────────┘ │
│                                          │
│ [TRANSCRIÇÃO TAB]                        │
│ ┌──────────────────────────────────────┐ │
│ │ 🔍 Buscar na transcrição…            │ │
│ └──────────────────────────────────────┘ │
│ 00:00  João                              │  ← speaker in emerald
│  "Vamos começar a reunião do Q3…"        │
│ 00:45  Maria                             │
│  "Concordo, o plano está [Q3] ótimo"     │  ← keyword highlight
│                                          │
│ [NOTAS TAB]                              │
│  [editable markdown TextInput]           │
│                                          │
│  📋 Action Items                         │
│  ☐  Revisar deck @João                  │
│  ☑  Enviar proposta @Maria              │
│                                          │
│  ✅ Decisões                             │
│  • Usar PostgreSQL                       │
│                                          │
│  [Gerar notas com IA]                   │  ← button
│                                ⊕         │  ← FAB: add block
│                                          │
│ [RESUMO TAB]                             │
│  [Executivo] [Detalhado] [Ações]        │  ← template chips
│  [Gerar Resumo]  or  rendered markdown  │
└──────────────────────────────────────────┘
```

"Transcrever agora" button: only shown in header `⋯` menu if no transcript yet.

---

## Phase 3 — Desktop Expansion (Electron)

### Screen Map

| Screen | Status |
|--------|--------|
| `MeetingsScreen` | New |
| `MeetingDetailScreen` | New |
| `PeopleScreen` | New |
| `QueueScreen` | Enhanced |
| `SettingsScreen` | Enhanced |

### Sidebar (enhanced)

```
┌─────────────────────────┐
│  DecisionDesk      [─□×]│  ← drag region + window controls
├─────────────────────────┤
│  📋 Reuniões            │  ← NEW
│  🖥  Fila               │  ← existing
│  👥 Pessoas             │  ← NEW
│  ⚙️  Configurações      │
├─────────────────────────┤
│  📁 Work                │  ← folder tree (collapsible)
│    📁 Q3                │
│  📁 Personal            │
├─────────────────────────┤
│  ● Backend conectado    │  ← connectivity dot
│  ⬡ 2 pendentes          │  ← sync badge
│  ◉ Whisper disponível   │
└─────────────────────────┘
```

### `MeetingDetailScreen` (desktop, wide window)

```
┌─ TRANSCRIPT (55%) ──────────────┬─ NOTES (45%) ─────────────────┐
│  Q3 Planning — 18 fev · 45m     │  Notas                        │
│  👤 João  👤 Maria              │                               │
│  [🔍 Search transcript…]    [Transcrever localmente ▶]          │  ← merged button
├─────────────────────────────────┤                               │
│  00:00  João                    │  [editable markdown area]     │
│  "Vamos começar..."             │                               │
│                                 │  📋 Action Items              │
│  00:45  Maria                   │  ☐ Revisar deck @João        │
│  "Concordo, o plano..."         │  ☑ Enviar proposta @Maria    │
│                                 │                               │
│                                 │  ✅ Decisões                  │
│                                 │  • Usar PostgreSQL            │
│                                 │                               │
│                                 │  [Resumo] tab available too   │
└─────────────────────────────────┴───────────────────────────────┘
```

### "Transcrever localmente" button (merged flow)

When clicked in `MeetingDetailScreen`:
1. Calls `window.electronAPI.queue.processJob(meetingId)` directly (enqueue + process)
2. Button changes to indeterminate spinner "Processando…"
3. On complete → transcript lines appear in `TranscriptView`
4. `QueueScreen` still shows job in history

### IPC additions in `main/index.ts`

```typescript
// New handlers
ipcMain.handle('meetings:list', (_, filter?) => repo.listMeetings(filter))
ipcMain.handle('meetings:get', (_, id: string) => repo.getMeeting(id))
ipcMain.handle('notes:get', (_, meetingId: string) => repo.getNotes(meetingId))
ipcMain.handle('notes:save', (_, meetingId: string, phase: string, content: string) => repo.saveNotes(meetingId, phase, content))
```

### `QueueScreen` (enhanced)

- Retry button for `FAILED` jobs
- Indeterminate `<progress>` bar while `PROCESSING`
- "Processar todos automaticamente" toggle (stores in settings)
- "Histórico" section: last 10 `COMPLETED` / `FAILED` jobs with timestamp

---

## Phase 4 — Web App — PR10

### Stack

- React 19 + Vite 6 (`create vite@latest` with React/TS template)
- React Router v7
- TanStack Query 5 (server state)
- Tailwind CSS 4
- Radix UI (accessible primitives: Dialog, Select, Tabs, Checkbox)
- Lucide React (icons — consistent with web icon style)
- Axios (API client)

### Layout

```
┌─ SIDEBAR ─────────┬─ MAIN AREA ──────────────────────────────┐
│ DecisionDesk      │                                          │
│ ──────────────    │  (MeetingDetailPage or empty state)       │
│ 🔍 Search…        │                                          │
│                   │                                          │
│ 📁 Work           │  Q3 Planning — 18 fev 2026               │
│   📁 Q3           │  João · Maria · Carlos                   │
│ 📁 Personal       │                                          │
│ ──────────────    │  [ Transcrição | Notas | Resumo ]        │
│                   │                                          │
│ HOJE              │  00:00  João: "Vamos começar…"           │
│ • Q3 Planning ✅  │  00:45  Maria: "Concordo…"              │
│ • Standup    ⏳   │                                          │
│                   │  [Notes panel below or right]             │
│ ONTEM             │                                          │
│ • Design rev. ✅  │                                          │
│ ──────────────    │                                          │
│ 🎙 Upload áudio   │                                          │  ← drag & drop zone
│ 👥 Pessoas        │                                          │
│ ⚙️ Config        │                                          │
└───────────────────┴──────────────────────────────────────────┘
```

### Routes

| Route | Component |
|-------|-----------|
| `/` | `MeetingsPage` (sidebar + empty main) |
| `/meetings/:id` | `MeetingDetailPage` (sidebar + detail panel) |
| `/people` | `PeoplePage` |
| `/settings` | `SettingsPage` |

### Upload flow (web)

1. User drags audio file onto sidebar upload zone or clicks "Upload áudio"
2. `POST /api/v1/meetings` → get `meetingId`
3. `POST /api/v1/meetings/{id}/audio` multipart → server stores file
4. User navigates to meeting → clicks "Transcrever agora" → `POST /api/v1/meetings/{id}/transcribe`
5. Polling every 10s until `status === 'DONE'`

### `MeetingDetailPage` (web)

Same 3-tab design as mobile. On wide screens: transcript (left 55%) + notes (right 45%) shown simultaneously (no tabs needed — panels). On narrow: tabs.

---

## Implementation Order

| Step | Scope | Key deliverables |
|------|-------|-----------------|
| 1 | `packages/types` | Full TypeScript interface library |
| 2 | `packages/utils` | `formatDuration`, `groupByDate`, `highlightMatches` etc. |
| 3 | Mobile — components | `WaveformView`, `InMeetingNotesPad`, `TabBar`, `TranscriptView`, `AINotesView`, `SummaryView`, `MeetingCard`, `SearchBar`, `EmptyState` |
| 4 | Mobile — screens | Redesign `MeetingListScreen`, `RecordScreen`, `MeetingDetailScreen` |
| 5 | Mobile — new screens + contexts | `SearchScreen`, `FolderScreen`, `PeopleScreen`, `NotesContext`, `FolderContext`, `PeopleContext`, new services |
| 6 | Desktop — new screens | `MeetingsScreen`, `MeetingDetailScreen`, `PeopleScreen` + sidebar |
| 7 | Desktop — IPC + queue enhance | `meetings:list/get`, `notes:get/save` handlers; `QueueScreen` retry/history |
| 8 | Web — scaffold | Vite project, routing, Tailwind, Axios config |
| 9 | Web — core pages | `MeetingsPage` with sidebar, `MeetingDetailPage` |
| 10 | Web — remaining pages | `PeoplePage`, `SettingsPage`, upload flow |

---

## Files to Create / Modify

### `packages/types`

- `packages/types/src/index.ts` — full rewrite

### `packages/utils`

- `packages/utils/src/index.ts` — expand

### Mobile — `apps/mobile/src/`

**New components:**
- `components/WaveformView.tsx`
- `components/InMeetingNotesPad.tsx`
- `components/TabBar.tsx`
- `components/TranscriptView.tsx`
- `components/AINotesView.tsx`
- `components/SummaryView.tsx`
- `components/MeetingCard.tsx`
- `components/SearchBar.tsx`
- `components/FolderBreadcrumb.tsx`
- `components/ParticipantRow.tsx`
- `components/ActionItemRow.tsx`
- `components/EmptyState.tsx`

**New screens:**
- `screens/SearchScreen.tsx`
- `screens/FolderScreen.tsx`
- `screens/PeopleScreen.tsx`

**New state:**
- `state/NotesContext.tsx`
- `state/FolderContext.tsx`
- `state/PeopleContext.tsx`

**New services:**
- `services/notesService.ts`
- `services/peopleService.ts`
- `services/folderService.ts`

**Modified:**
- `screens/MeetingListScreen.tsx` — full redesign
- `screens/RecordScreen.tsx` — waveform + notes pad
- `screens/MeetingDetailScreen.tsx` — 3-tab redesign
- `navigation/AppNavigator.tsx` — add 3 new routes

### Desktop — `apps/desktop/src/`

**New:**
- `renderer/screens/MeetingsScreen.tsx`
- `renderer/screens/MeetingDetailScreen.tsx`
- `renderer/screens/PeopleScreen.tsx`

**Modified:**
- `renderer/App.tsx` — new routes + sidebar nav
- `renderer/screens/QueueScreen.tsx` — retry + history + auto toggle
- `main/index.ts` — 4 new IPC handlers

### Web — `apps/web/` (create from scratch)

- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tailwind.config.ts`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/pages/MeetingsPage.tsx`
- `src/pages/MeetingDetailPage.tsx`
- `src/pages/PeoplePage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/components/Sidebar.tsx`
- `src/components/MeetingCard.tsx`
- `src/components/TranscriptView.tsx`
- `src/components/AINotesView.tsx`
- `src/components/SummaryView.tsx`
- `src/components/TabBar.tsx`
- `src/components/UploadZone.tsx`
- `src/hooks/useMeetings.ts`
- `src/hooks/useMeetingDetail.ts`
- `src/services/api.ts`

---

## Verification

### Mobile

```bash
cd apps/mobile && npx expo start --ios
# Navigate: Home → Record → stop → MeetingDetail → switch 3 tabs
# Test: search box highlights transcript
# Test: slide-up note pad during recording
# Test: notes tab shows parsed action items
npx tsc --noEmit
npm test
```

### Desktop

```bash
cd apps/desktop && npm run dev
# Check sidebar: Reuniões, Fila, Pessoas, Config
# Reuniões → click meeting → 3-tab detail + "Transcrever localmente" button
# Queue: retry button visible on failed, history section present
npm run typecheck
```

### Web

```bash
cd apps/web && npm run dev
# http://localhost:5173 → sidebar + meeting list
# Select meeting → 3-tab detail
# Drag audio file → upload flow
npx tsc --noEmit
```

### Backend (confirm no regressions)

```bash
make backend-test
```

No backend changes required — all new client features use existing endpoints.
