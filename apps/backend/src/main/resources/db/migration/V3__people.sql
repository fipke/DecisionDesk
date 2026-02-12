-- V3__people.sql
-- PR08: People (Participants + Mentions)

-- People table - can be participants or mentioned in meetings
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(50) NOT NULL,  -- short name for @mentions
    full_name VARCHAR(200),
    email VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for meeting-person relationships
CREATE TABLE IF NOT EXISTS meeting_people (
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('participant', 'mentioned')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (meeting_id, person_id, role)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_people_display_name ON people(display_name);
CREATE INDEX IF NOT EXISTS idx_people_display_name_lower ON people(LOWER(display_name));
CREATE INDEX IF NOT EXISTS idx_meeting_people_meeting ON meeting_people(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_people_person ON meeting_people(person_id);
