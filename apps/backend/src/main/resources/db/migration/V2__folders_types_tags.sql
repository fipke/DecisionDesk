-- V2__folders_types_tags.sql
-- PR07: Organization structure - Folders, Meeting Types, and Tags

-- Folders table (hierarchical organization)
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    path VARCHAR(500) NOT NULL UNIQUE,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    default_tags JSONB DEFAULT '{}',
    default_whisper_model VARCHAR(20),
    summary_template_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting types table
CREATE TABLE IF NOT EXISTS meeting_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    required_tags JSONB DEFAULT '{}',
    default_whisper_model VARCHAR(20),
    summary_template_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to meetings
ALTER TABLE meetings 
    ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS meeting_type_id UUID REFERENCES meeting_types(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS title VARCHAR(200),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_folder ON meetings(folder_id);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(meeting_type_id);
CREATE INDEX IF NOT EXISTS idx_meetings_tags ON meetings USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);

-- Insert default folder (root)
INSERT INTO folders (id, name, path) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Raiz', '/')
ON CONFLICT (path) DO NOTHING;
