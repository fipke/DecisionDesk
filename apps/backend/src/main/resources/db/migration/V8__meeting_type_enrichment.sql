-- V8: Multi-summary support + Meeting Type enrichment as "starter templates"
-- Allows multiple summaries per meeting (one per template) and enriches
-- meeting_types with multi-template associations, extraction config, and UI metadata.

-- ─── 1. Allow multiple summaries per meeting ────────────────────────────────

-- Drop the old unique constraint that limited to 1 summary per meeting
ALTER TABLE summaries DROP CONSTRAINT IF EXISTS summaries_meeting_id_key;

-- Composite unique: one summary per (meeting, template)
CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_meeting_template
  ON summaries(meeting_id, template_id) WHERE template_id IS NOT NULL;

-- Allow exactly one "default" (no template) summary per meeting
CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_meeting_default
  ON summaries(meeting_id) WHERE template_id IS NULL;

-- ─── 2. Enrich meeting_types as starter templates ───────────────────────────

ALTER TABLE meeting_types
  ADD COLUMN IF NOT EXISTS summary_template_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS extraction_config JSONB
    DEFAULT '{"action_items":true,"decisions":true,"deadlines":true}',
  ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(20) DEFAULT 'ollama',
  ADD COLUMN IF NOT EXISTS default_participants UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS icon VARCHAR(50),
  ADD COLUMN IF NOT EXISTS color VARCHAR(7);

-- ─── 3. Add extraction_config to summary_templates ──────────────────────────
-- When set on a template, overrides the meeting_type extraction_config.

ALTER TABLE summary_templates
  ADD COLUMN IF NOT EXISTS extraction_config JSONB DEFAULT NULL;

-- ─── 4. AI provider settings (stored in user_preferences) ──────────────────
-- Extend existing user_preferences table from V5 with AI configuration.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{
    "summarization": {"provider": "ollama", "model": "qwen2.5:14b"},
    "extraction": {"provider": "ollama", "model": "qwen2.5:14b"},
    "chat": {"provider": "ollama", "model": "qwen2.5:14b"},
    "openaiEnabled": false
  }';

-- ─── 5. Seed data: PowerBI weekly template + Ray meeting type ───────────────

INSERT INTO summary_templates (id, name, description, system_prompt, user_prompt_template, model, extraction_config)
VALUES (
  '00000000-0000-0000-0000-000000000013',
  'Acompanhamento Semanal',
  'Reuniões semanais de acompanhamento com parceiros',
  'Você é um assistente especializado em criar resumos estruturados de reuniões semanais de acompanhamento de projetos.

Formato obrigatório do resumo:
- Use markdown compatível com Obsidian
- Tom profissional, conciso e direto
- Sempre em português brasileiro
- Inclua timestamps quando mencionados
- Separe claramente ações por responsável

Seções obrigatórias:
1. Pendências (itens da semana anterior ainda abertos)
2. Concluídos (itens finalizados desde a última reunião)
3. Próximos Passos (novas tarefas definidas)
4. Ações por Responsável (agrupadas por pessoa)
5. Backlog (itens mencionados para futuro, sem prazo)',
  'Analise a transcrição da reunião de acompanhamento semanal abaixo e crie um resumo estruturado seguindo as seções obrigatórias.

Participantes conhecidos: {{participants}}

---
TRANSCRIÇÃO:
{{transcript}}',
  'gpt-4o',
  '{"action_items":true,"decisions":true,"deadlines":true,"backlog":true,"completed_items":true}'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO meeting_types (id, name, description, summary_template_ids, extraction_config, icon, color)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  'Reunião Ray (PowerBI)',
  'Reunião semanal de acompanhamento Dashboards PowerBI com Ray',
  ARRAY['00000000-0000-0000-0000-000000000013'::uuid, '00000000-0000-0000-0000-000000000010'::uuid],
  '{"action_items":true,"decisions":true,"deadlines":true,"backlog":true}',
  'bar-chart',
  '#6366f1'
)
ON CONFLICT (id) DO NOTHING;
