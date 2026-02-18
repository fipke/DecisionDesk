# PR09 — AI Summaries + Templates ✅

**Scope**: Backend + Mobile  
**Status**: Complete — commit `91cd7963`

## What was built

### Database — `V4__summary_templates.sql`

**`summary_templates`**
```
id             UUID PK
name           TEXT NOT NULL
system_prompt  TEXT NOT NULL
user_prompt    TEXT NOT NULL
style          TEXT  -- 'brief' | 'detailed' | 'action_focused' | custom
is_default     BOOLEAN DEFAULT false
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
```

**`meeting_summaries`**
```
id             UUID PK
meeting_id     UUID FK → meetings
template_id    UUID FK → summary_templates (nullable)
provider       TEXT  -- 'openai'
model          TEXT  -- 'gpt-4o'
style          TEXT
body_markdown  TEXT
created_at     TIMESTAMPTZ
```

### API

**Summary Templates — `SummaryTemplatesController`**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/summary-templates` | List all templates |
| `POST` | `/api/v1/summary-templates` | Create template |
| `GET` | `/api/v1/summary-templates/{id}` | Get template |
| `PATCH` | `/api/v1/summary-templates/{id}` | Update template |
| `DELETE` | `/api/v1/summary-templates/{id}` | Delete template |
| `POST` | `/api/v1/meetings/{id}/summaries` | Generate summary (GPT-4o) |
| `GET` | `/api/v1/meetings/{id}/summaries` | List summaries for meeting |

### Default templates seeded
- **Resumo Breve** — 3-5 bullet points, decisions and actions only
- **Detalhado** — full narrative with context
- **Focado em Ações** — numbered action items with owners and deadlines

### SummaryService
- Builds GPT-4o prompt from template + transcript text
- Respects `OPENAI_API_KEY` env var; backend-only call (clients never call OpenAI directly)
- Stores result in `meeting_summaries` with token cost logged

### Mobile
- Summary tab on `MeetingDetailScreen`
- Template picker dropdown
- Generates on-demand; cached locally in SQLite
