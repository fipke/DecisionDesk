# DecisionDesk — Next Phase Plan

## Findings from Codebase Analysis

### 1. Meeting Durations — NOT fully wired
- `audio_assets.duration_sec` exists in PostgreSQL (V1 migration)
- `WhisperCostCalculator` uses it for billing minutes
- BUT: `ListMeetingResponse` only returns `(id, status, title, createdAt, updatedAt)` — **no duration**
- Mobile/Desktop local DBs have `minutes` column but it's never populated from API
- Web `types.ts` has `minutes?: number | null` but API never sends it
- **Conclusion**: Duration data is captured but never exposed to clients

### 2. Templates — Backend exists, no frontend UI
- `summary_templates` table (V4): `system_prompt`, `user_prompt_template`, `output_format`, `model`, `max_tokens`, `temperature`
- 3 seeded templates: "Resumo Executivo", "Ata Formal", "Resumo Técnico"
- `userPromptTemplate` uses `{{transcript}}` placeholder and outputs **markdown** already
- `meeting_types` table has `summary_template_id` FK — categories can already link to templates
- `folders` table also has `summary_template_id` FK
- Full CRUD repo exists (`SummaryTemplateRepository`)
- **Missing**: No frontend UI to view/edit/assign templates

### 3. "Meetings" naming — deeply embedded
- ~100+ files reference "meeting" in code (Java packages, DB tables, API routes, TS types, UI labels)
- Full rename would be massive, risky, and break all API contracts
- **Pragmatic recommendation**: Rename only UI-facing labels, keep internal code as-is
- `meeting_types` table already serves as "recording categories"

### 4. Theme — very dark, needs warmth
- Desktop: `bg-slate-950` (#0f172a), `bg-slate-900` for sidebar, emerald accent
- Web: same palette, `darkMode: 'class'` configured but no toggle
- No custom color tokens beyond `brand` (emerald)

### 5. Desktop title — basic text, no branding
- `titleBarStyle: 'hiddenInset'`, `pl-[70px]` for traffic lights
- Just renders `<h1>DecisionDesk</h1>` in text

---

## Implementation Plan

### PR17 — Recording Categories + UI Labels Rename
**Goal**: Rename user-facing text "Reuniões" → "Gravações" + expose recording categories

**Backend**:
- V8 migration: seed default recording categories into `meeting_types`:
  - Reunião, Conversa, Culto, Aula, Entrevista, Palestra, Outro
- Add `GET /api/v1/meeting-types` endpoint (list categories)
- Add `POST /api/v1/meeting-types` endpoint (create custom category)

**Desktop**:
- Sidebar: "Reuniões" → "Gravações"
- MeetingsScreen: header "Gravações", filter chips by category
- RecordScreen: category selector before recording
- Local DB: seed default categories into `meeting_types` table

**Mobile**:
- MeetingListScreen: header "Gravações"
- RecordScreen: category selector
- MeetingCard: show category badge

**Web**:
- MeetingsPage: header "Gravações", category filter tabs
- Import modal: category selector

### PR18 — Duration Exposure + Display
**Goal**: Wire `duration_sec` from backend all the way to UI

**Backend**:
- Add `durationSec` field to `ListMeetingResponse` (join `audio_assets` on `meeting_id`)
- Add `durationSec` to `MeetingDetailsResponse`
- For recordings without transcription: store duration from client upload metadata

**Desktop**:
- RecordScreen: save elapsed seconds as `durationSec` when stopping recording
- MeetingsScreen: show formatted duration (MM:SS or "1h 23min")
- MeetingDetailScreen: show duration

**Mobile**:
- RecordScreen: save duration on stop
- MeetingCard: show duration
- Sync: populate `minutes` from API `durationSec`

**Web**:
- MeetingCard: show duration from API
- Update `Meeting` type: add `durationSec`

### PR19 — Template Management UI
**Goal**: Frontend for viewing, editing, and assigning summary templates

**Backend**:
- Add `GET /api/v1/summary-templates` endpoint (already has repo CRUD)
- Add `POST /api/v1/summary-templates` endpoint
- Add `PUT /api/v1/summary-templates/{id}` endpoint
- Add `DELETE /api/v1/summary-templates/{id}` endpoint
- Add `PATCH /api/v1/meeting-types/{id}/template` — assign template to category

**Desktop**:
- New "Modelos" nav item in sidebar
- TemplatesScreen: list templates as cards with preview
- TemplateEditor: markdown-aware editor for `userPromptTemplate`
  - Split view: edit left, rendered preview right
  - Fields: name, description, system prompt, user prompt template
  - Available variables shown: `{{transcript}}`, `{{title}}`, `{{date}}`, `{{participants}}`
- Category → template assignment in settings or category picker

**Web**:
- Templates page at `/templates`
- Same editor concept (simpler, modal-based)

**Mobile** (read-only):
- View assigned template when summarizing
- Template picker on summarize action

### PR20 — Modern Theme + Professional Colors
**Goal**: Refined dark theme with modern, professional palette

**Design tokens** (shared across web + desktop Tailwind configs):
```
Background layers:
  base:     #0c0f17  (deep navy, not pure black)
  surface:  #141825  (elevated cards/sidebar)
  elevated: #1c2133  (modals, dropdowns)

Borders:
  subtle:   #252b3d
  default:  #2e3650

Text:
  primary:   #e8eaf0
  secondary: #8b92a8
  muted:     #5c6380

Brand accent:
  primary:   #6366f1  (indigo-500 — more professional than emerald)
  hover:     #818cf8  (indigo-400)
  subtle:    #6366f1/10  (10% opacity for backgrounds)

Status:
  success:  #22c55e  (green-500)
  warning:  #f59e0b  (amber-500)
  error:    #ef4444  (red-500)
  info:     #3b82f6  (blue-500)

Recording category accents (for badges):
  reunião:   #6366f1  (indigo)
  conversa:  #8b5cf6  (violet)
  culto:     #f59e0b  (amber)
  aula:      #3b82f6  (blue)
  entrevista:#ec4899  (pink)
  palestra:  #14b8a6  (teal)
```

**Implementation**:
- Update `tailwind.config` on web + desktop with semantic color tokens
- Replace all `slate-950/900/800` references with new tokens
- Update `BrowserWindow.backgroundColor` to match `base`
- Mobile: update NativeWind theme colors accordingly
- Active nav: use brand primary instead of emerald
- Cards: subtle gradient or glass-morphism effect with `backdrop-blur`
- Buttons: rounded-xl with subtle shadows

### PR21 — Desktop Title Bar + SVG Logo
**Goal**: Professional title bar with logo, better alignment

**Logo** (SVG):
- Concept: Stylized "D" lettermark with recording waveform motif
- Indigo gradient to match new brand color
- Clean, geometric, modern

**Desktop title bar**:
- Add SVG logo icon (24x24) next to "DecisionDesk" text
- Fine-tune drag region padding for macOS traffic lights
- Ensure vertical centering with traffic light buttons
- Subtle separator between logo area and nav

**Mobile**:
- Add logo to header/splash screen

**Web**:
- Add logo to top-left of page header

### PR22 — Remaining Features (from original plan)
- Series with AI context carry-over
- Action items extraction
- Meeting AI Chat
- Speaker identification

These are larger features deferred to a later phase.

---

## Execution Order

| Order | PR   | Description                          | Depends on |
|-------|------|--------------------------------------|------------|
| 1     | PR20 | Modern Theme + Professional Colors   | —          |
| 2     | PR21 | Desktop Title Bar + SVG Logo         | PR20       |
| 3     | PR17 | Recording Categories + Labels Rename | —          |
| 4     | PR18 | Duration Exposure + Display          | —          |
| 5     | PR19 | Template Management UI               | PR17       |

PR20 (theme) first because it changes every screen — doing it first avoids rework.
PR21 (logo/title) right after since it builds on the new color palette.
PR17 (categories + rename) can proceed independently.
PR18 (duration) is standalone.
PR19 (templates) after categories since templates link to categories.
