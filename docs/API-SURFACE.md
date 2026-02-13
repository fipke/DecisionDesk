# API Surface

## Core Endpoints
- **Health**: GET `/actuator/health`
- **Meetings**: 
  - POST `/api/v1/meetings` - Create new meeting
  - GET `/api/v1/meetings/{id}` - Get meeting details
  - PATCH `/api/v1/meetings/{id}/title` - Update meeting title
  - POST `/api/v1/meetings/{id}/audio` - Upload audio file
  - POST `/api/v1/meetings/{id}/transcribe` - Trigger transcription
  
## Meeting Notes (PR-Notes)
- GET `/api/v1/meetings/{id}/notes` - Get all notes (agenda, live, post)
- PATCH `/api/v1/meetings/{id}/notes/agenda` - Update agenda (pre-meeting)
- PATCH `/api/v1/meetings/{id}/notes/live` - Update live notes (during meeting)
- PATCH `/api/v1/meetings/{id}/notes/post` - Update post-meeting notes
- GET `/api/v1/meetings/{id}/notes/action-items` - Get extracted action items
- GET `/api/v1/meetings/{id}/notes/decisions` - Get extracted decisions
- POST `/api/v1/meetings/{id}/notes/link-previous` - Link to previous meeting
- GET `/api/v1/meetings/{id}/notes/previous-context` - Get previous meeting context
- GET `/api/v1/meetings/{id}/notes/gpt-context` - Get formatted GPT context
- POST `/api/v1/meetings/{id}/notes/import` - Import transcript file

## Meeting Series
- GET `/api/v1/meeting-series` - List all series
- POST `/api/v1/meeting-series` - Create series
- GET `/api/v1/meeting-series/{id}` - Get series details
- PATCH `/api/v1/meeting-series/{id}` - Update series
- DELETE `/api/v1/meeting-series/{id}` - Delete series
- GET `/api/v1/meeting-series/{id}/meetings` - List meetings in series
- POST `/api/v1/meeting-series/{id}/meetings` - Add meeting to series

## Import
- POST `/api/v1/import/file` - Import transcript from file (Teams/Zoom .vtt/.txt/.docx)
- POST `/api/v1/import/text` - Import transcript from plain text

## User Preferences
- GET `/api/v1/preferences/{userId}` - Get user preferences
- PATCH `/api/v1/preferences/{userId}` - Update preferences (language, template)

## Organization (PR07)
- Folders, Types, Tags (existing endpoints)
