# PR08 — People (Participants & Mentions) ✅

**Scope**: Backend + Mobile  
**Status**: Complete — commit `14cc5d70`

## What was built

### Database — `V3__people.sql`

**`people`**
```
id           UUID PK
display_name TEXT NOT NULL          -- short name for @mentions
full_name    TEXT
email        TEXT
notes        TEXT
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ
```

**`meeting_people`**
```
meeting_id   UUID FK → meetings
person_id    UUID FK → people
role         TEXT  -- 'participant' | 'mentioned'
created_at   TIMESTAMPTZ
PRIMARY KEY (meeting_id, person_id, role)
```

### API

**People — `PeopleController`**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/people` | List all people |
| `POST` | `/api/v1/people` | Create person |
| `GET` | `/api/v1/people/{id}` | Get person |
| `PATCH` | `/api/v1/people/{id}` | Update person |
| `DELETE` | `/api/v1/people/{id}` | Delete person |

**Meeting People — `MeetingPeopleController`**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/meetings/{id}/people` | List participants and mentions |
| `POST` | `/api/v1/meetings/{id}/people` | Add person to meeting |
| `DELETE` | `/api/v1/meetings/{id}/people/{personId}/{role}` | Remove association |

### Mobile integration
- `PersonService` + local SQLite tables `people`, `meeting_people`
- @mention input on `MeetingDetailScreen`
- Participant list with role badges (participant / mentioned)
- People synced via outbox queue when reconnected
