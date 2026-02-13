# PR-Notes: Meeting Notes Feature

## Overview
Comprehensive meeting notes system with pre/during/post-meeting notes, continuity tracking, series management, and transcript import from external platforms.

## Features

### 1. Three-Phase Note Taking
**Agenda (Pre-Meeting)**
- Meeting objectives and topics
- Participants list
- Pre-read materials

**Live Notes (During Meeting)**
- Real-time note taking with semantic blocks
- Action items with assignees
- Key decisions
- Discussion points

**Post Notes (After Meeting)**
- Meeting recap
- Follow-up items
- Outcomes and next steps

### 2. Semantic Markdown Blocks
Notes use a structured markdown format for semantic parsing:

```markdown
---
#ACTION ITEMS
- [ ] Review PR @John
- [x] Deploy to staging @Maria
- [ ] Update documentation
---

---
#DECISIONS
- Use PostgreSQL for persistence
- Deploy on Azure
- Implement CQRS pattern
---

---
#DISCUSSION
Meeting discussion text here...
---
```

**Block Types**: ACTION ITEMS, DECISIONS, DISCUSSION, NOTES, SUMMARY, ATTENDEES, etc.

**Parsing**: Backend automatically parses blocks to extract:
- Action items with checkbox state (`[ ]` or `[x]`)
- Assignees via `@mentions`
- Decisions as bullet lists
- Custom block types

### 3. Action Items
- Checkbox format: `- [ ]` (open) or `- [x]` (completed)
- Support for @mentions to assign tasks
- Extracted automatically from ACTION ITEMS blocks
- Can be queried separately: `GET /api/v1/meetings/{id}/notes/action-items`

### 4. Meeting Continuity
**Link to Previous Meeting**
```
POST /api/v1/meetings/{id}/notes/link-previous
{
  "previousMeetingId": "uuid"
}
```

**Get Previous Context**
```
GET /api/v1/meetings/{id}/notes/previous-context
```
Returns:
- Previous meeting summary
- Open action items from previous meeting
- Previous decisions

**GPT Context Injection**
When generating summaries, automatically inject previous meeting context:
```
GET /api/v1/meetings/{id}/notes/gpt-context
```
Returns formatted context for GPT prompt.

### 5. Meeting Series
Group related recurring meetings together:

**Create Series**
```
POST /api/v1/meeting-series
{
  "name": "Weekly Standup",
  "description": "Team sync",
  "recurrenceRule": "FREQ=WEEKLY;BYDAY=MO"
}
```

**Add Meeting to Series**
```
POST /api/v1/meeting-series/{seriesId}/meetings
{
  "meetingId": "uuid"
}
```

Automatically sets sequence number and links to previous meeting in series.

### 6. Transcript Import
Import transcripts from external platforms without audio files:

**Supported Formats**:
- `.vtt` (WebVTT) - Teams, Zoom
- `.txt` (Plain text)
- `.docx` (Word documents) - Teams exports

**Import via File**
```
POST /api/v1/import/file
Content-Type: multipart/form-data

file: [transcript file]
source: "teams" | "zoom" | "webex" | "manual"
title: "Meeting Title"
```

**Import via Text**
```
POST /api/v1/import/text
{
  "text": "Transcript content...",
  "title": "Meeting Title",
  "source": "manual"
}
```

**Import to Existing Meeting**
```
POST /api/v1/meetings/{id}/notes/import
Content-Type: multipart/form-data

file: [transcript file]
source: "teams"
```

**Auto-Detection**:
- Source detected from filename (teams-*.vtt → "teams")
- Language detected from content (en/pt-BR/es)
- VTT timestamps removed automatically
- Teams speaker tags (`<v Name>`) parsed

### 7. User Preferences
**Language Templates**: Default notes template by user language

```
GET /api/v1/preferences/{userId}
```
Returns:
```json
{
  "id": "uuid",
  "userId": "user123",
  "defaultLanguage": "pt-BR",
  "notesTemplate": "custom template or null"
}
```

**Update Preferences**
```
PATCH /api/v1/preferences/{userId}
{
  "defaultLanguage": "en",
  "notesTemplate": "# Custom template..."
}
```

**Supported Languages**:
- `en` - English
- `pt-BR` - Portuguese (Brazil)
- `es` - Spanish

### 8. Auto-Clean Empty Blocks
When saving live notes with `cleanEmpty=true`, automatically removes empty template blocks:

```
PATCH /api/v1/meetings/{id}/notes/live
{
  "content": "...",
  "cleanEmpty": true
}
```

## Database Schema (V5 Migration)

**New Tables**:
- `user_preferences` - User language and template preferences
- `meeting_series` - Recurring meeting series
- `notes_block_types` - Enum of block types
- `notes_templates` - Default templates by language

**Meeting Table Updates**:
- `agenda` TEXT - Pre-meeting notes
- `live_notes` TEXT - During-meeting notes
- `post_notes` TEXT - Post-meeting notes
- `previous_meeting_id` UUID - Link to previous meeting
- `series_id` UUID - FK to meeting series
- `sequence_num` INTEGER - Position in series
- `imported_transcript_source` VARCHAR - Import source (teams/zoom/manual)

## API Endpoints

### Notes CRUD
- `GET /api/v1/meetings/{id}/notes` - Get all notes
- `PATCH /api/v1/meetings/{id}/notes/agenda` - Update agenda
- `PATCH /api/v1/meetings/{id}/notes/live` - Update live notes
- `PATCH /api/v1/meetings/{id}/notes/post` - Update post notes

### Extraction
- `GET /api/v1/meetings/{id}/notes/action-items` - Get action items
- `GET /api/v1/meetings/{id}/notes/decisions` - Get decisions

### Continuity
- `POST /api/v1/meetings/{id}/notes/link-previous` - Link previous meeting
- `GET /api/v1/meetings/{id}/notes/previous-context` - Get context
- `GET /api/v1/meetings/{id}/notes/gpt-context` - Get GPT-formatted context

### Series Management
- `GET /api/v1/meeting-series` - List series
- `POST /api/v1/meeting-series` - Create series
- `GET /api/v1/meeting-series/{id}` - Get series
- `PATCH /api/v1/meeting-series/{id}` - Update series
- `DELETE /api/v1/meeting-series/{id}` - Delete series
- `GET /api/v1/meeting-series/{id}/meetings` - List meetings in series
- `POST /api/v1/meeting-series/{id}/meetings` - Add meeting to series

### Import
- `POST /api/v1/import/file` - Import from file
- `POST /api/v1/import/text` - Import from text
- `POST /api/v1/meetings/{id}/notes/import` - Import to existing meeting

### Preferences
- `GET /api/v1/preferences/{userId}` - Get preferences
- `PATCH /api/v1/preferences/{userId}` - Update preferences

## Implementation

### Core Components
- **NotesBlockParser**: Parses markdown blocks, extracts action items/decisions
- **MeetingNotesService**: Business logic for notes CRUD, continuity, series
- **TranscriptImportService**: Handles file parsing (.vtt/.txt/.docx), meeting creation
- **MeetingNotesController**: REST endpoints for notes operations
- **MeetingSeriesController**: Series management endpoints
- **TranscriptImportController**: Import endpoints
- **UserPreferencesController**: Preferences endpoints

### Key Services
```java
// Parse markdown blocks
List<NotesBlock> blocks = notesBlockParser.parseBlocks(liveNotes);

// Extract action items
List<ActionItem> items = notesService.getActionItems(meetingId);

// Get previous meeting context for GPT
String context = notesService.buildContextForGpt(meetingId);

// Import Teams transcript
ImportResult result = importService.importTranscript(file, "teams", "Meeting Title");
```

## Usage Examples

### 1. Pre-Meeting Setup
```http
# Create meeting
POST /api/v1/meetings

# Set agenda
PATCH /api/v1/meetings/{id}/notes/agenda
{
  "content": "## Agenda\n- Sprint review\n- Q3 planning\n- Team updates"
}
```

### 2. During Meeting
```http
# Live note taking
PATCH /api/v1/meetings/{id}/notes/live
{
  "content": "---\n#ACTION ITEMS\n- [ ] Review PR @John\n---\n\n---\n#DECISIONS\n- Use PostgreSQL\n---"
}

# Query action items
GET /api/v1/meetings/{id}/notes/action-items
```

### 3. Post Meeting
```http
# Add post notes
PATCH /api/v1/meetings/{id}/notes/post
{
  "content": "## Summary\nGreat meeting, all action items assigned."
}

# Link continuity for next meeting
POST /api/v1/meetings/{next-id}/notes/link-previous
{
  "previousMeetingId": "{id}"
}
```

### 4. Import External Transcript
```http
# Import Teams transcript
POST /api/v1/import/file
Content-Type: multipart/form-data

file: teams-meeting-transcript.vtt
source: teams
title: Q4 Planning Meeting
```

## Benefits

1. **Centralized Meeting Repository**: All meetings, transcripts, and notes in one place
2. **Cross-Meeting Context**: Link meetings for continuity, track recurring discussions
3. **AI-Ready**: Structured notes + context injection for better GPT summaries
4. **Platform Agnostic**: Import transcripts from Teams, Zoom, or any source
5. **Multilingual**: Support for en, pt-BR, es with localized templates
6. **Action Tracking**: Automatic extraction of tasks and decisions
7. **Series Management**: Group related meetings, track progress over time

## Future Enhancements
- [ ] Auto-link meetings by title pattern
- [ ] Smart suggestions for action items
- [ ] Integration with calendars (import meeting details)
- [ ] Export notes to Notion, Confluence
- [ ] Voice commands for live note taking
- [ ] AI-powered action item completion prediction
