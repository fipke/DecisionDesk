-- V5__notes_continuity.sql
-- Meeting Notes, Series & Document Import

-- =============================================================================
-- User Preferences
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) UNIQUE NOT NULL,  -- device/session ID for now
    default_language VARCHAR(5) DEFAULT 'en',
    notes_template TEXT,  -- custom notes template override
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- =============================================================================
-- Meeting Series (for recurring/linked meetings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS meeting_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    recurrence_rule VARCHAR(100),  -- RRULE format or simple: daily/weekly/monthly
    default_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    default_type_id UUID REFERENCES meeting_types(id) ON DELETE SET NULL,
    default_tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_series_name ON meeting_series(name);

-- =============================================================================
-- Meeting Notes & Links
-- =============================================================================
ALTER TABLE meetings 
    ADD COLUMN IF NOT EXISTS agenda TEXT,
    ADD COLUMN IF NOT EXISTS live_notes TEXT,
    ADD COLUMN IF NOT EXISTS post_notes TEXT,
    ADD COLUMN IF NOT EXISTS previous_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES meeting_series(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sequence_num INTEGER,
    ADD COLUMN IF NOT EXISTS imported_transcript_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_meetings_previous ON meetings(previous_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings(series_id);
CREATE INDEX IF NOT EXISTS idx_meetings_imported_source ON meetings(imported_transcript_source) WHERE imported_transcript_source IS NOT NULL;

-- =============================================================================
-- Notes Block Types (lookup for UI/localization)
-- =============================================================================
CREATE TABLE IF NOT EXISTS notes_block_types (
    id VARCHAR(50) PRIMARY KEY,  -- ACTION_ITEMS, DECISIONS, TOPICS, etc.
    label_en VARCHAR(100) NOT NULL,
    label_pt_br VARCHAR(100),
    label_es VARCHAR(100),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default block types
INSERT INTO notes_block_types (id, label_en, label_pt_br, label_es, icon, sort_order) VALUES
    ('ACTION_ITEMS', 'ACTION ITEMS', 'ITENS DE AÇÃO', 'TAREAS PENDIENTES', 'checkbox', 1),
    ('DECISIONS', 'DECISIONS', 'DECISÕES', 'DECISIONES', 'gavel', 2),
    ('TOPICS', 'TOPICS TO DISCUSS', 'TÓPICOS A DISCUTIR', 'TEMAS A DISCUTIR', 'list', 3),
    ('FOLLOW_UP', 'FOLLOW UP', 'ACOMPANHAMENTO', 'SEGUIMIENTO', 'refresh', 4),
    ('PARKING_LOT', 'PARKING LOT', 'ESTACIONAMENTO', 'ESTACIONAMIENTO', 'pause', 5)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Default Notes Templates by Language
-- =============================================================================
CREATE TABLE IF NOT EXISTS notes_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language VARCHAR(5) NOT NULL,
    name VARCHAR(100) NOT NULL,
    template TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(language, name)
);

-- Insert default templates
INSERT INTO notes_templates (id, language, name, template, is_default) VALUES
(
    '00000000-0000-0000-0000-000000000020',
    'en',
    'Standard Meeting Notes',
    '---
#ACTION ITEMS
- [ ] 
---

## Notes


---
#DECISIONS

---',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000021',
    'pt-BR',
    'Notas de Reunião Padrão',
    '---
#ITENS DE AÇÃO
- [ ] 
---

## Notas


---
#DECISÕES

---',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000022',
    'es',
    'Notas de Reunión Estándar',
    '---
#TAREAS PENDIENTES
- [ ] 
---

## Notas


---
#DECISIONES

---',
    TRUE
)
ON CONFLICT (language, name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_notes_templates_language ON notes_templates(language);
CREATE INDEX IF NOT EXISTS idx_notes_templates_default ON notes_templates(is_default) WHERE is_default = TRUE;
