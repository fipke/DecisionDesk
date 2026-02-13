-- V4__summary_templates.sql
-- PR09: Summary Templates and GPT-4 Integration

-- Summary templates table
CREATE TABLE IF NOT EXISTS summary_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,  -- system role for GPT
    user_prompt_template TEXT NOT NULL,  -- template with {{transcript}} placeholder
    output_format VARCHAR(20) DEFAULT 'markdown',  -- markdown, json, plain
    model VARCHAR(50) DEFAULT 'gpt-4o',  -- gpt-4o, gpt-4-turbo, etc.
    max_tokens INTEGER DEFAULT 2000,
    temperature NUMERIC(2,1) DEFAULT 0.3,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK constraints to folders and meeting_types (can't add REFERENCES on existing column change)
-- The columns already exist from V2, just need index

-- Update summaries table to track template and model used
ALTER TABLE summaries 
    ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES summary_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS model VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tokens_used INTEGER,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_summary_templates_default ON summary_templates(is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_summaries_template ON summaries(template_id);

-- Insert default summary templates
INSERT INTO summary_templates (id, name, description, system_prompt, user_prompt_template, is_default, model) 
VALUES (
    '00000000-0000-0000-0000-000000000010',
    'Resumo Executivo',
    'Resumo conciso para reuniões gerais',
    'Você é um assistente especializado em criar resumos executivos de reuniões. 
Seja conciso, objetivo e destaque os pontos principais.
Responda sempre em português brasileiro.',
    'Analise a transcrição da reunião abaixo e crie um resumo executivo com as seguintes seções:

## Resumo
(2-3 frases resumindo a reunião)

## Principais Pontos Discutidos
(lista com bullet points)

## Decisões Tomadas
(lista de decisões, se houver)

## Próximos Passos / Action Items
(lista de tarefas com responsáveis se mencionados)

## Participantes Mencionados
(lista de pessoas mencionadas)

---
TRANSCRIÇÃO:
{{transcript}}',
    TRUE,
    'gpt-4o'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO summary_templates (id, name, description, system_prompt, user_prompt_template, is_default, model) 
VALUES (
    '00000000-0000-0000-0000-000000000011',
    'Ata de Reunião Formal',
    'Formato de ata corporativa detalhada',
    'Você é um assistente especializado em criar atas de reunião formais e profissionais.
Use linguagem corporativa e formal.
Responda sempre em português brasileiro.',
    'Crie uma ata de reunião formal baseada na transcrição abaixo:

# ATA DE REUNIÃO

**Data:** [extrair da transcrição ou informar "não especificado"]
**Participantes:** [listar participantes mencionados]

## 1. Pauta / Assuntos Tratados

[Descrever cada tópico discutido em detalhes]

## 2. Deliberações

[Decisões tomadas durante a reunião]

## 3. Encaminhamentos

| Ação | Responsável | Prazo |
|------|-------------|-------|
[tabela de action items]

## 4. Observações Gerais

[Outras informações relevantes]

---
TRANSCRIÇÃO:
{{transcript}}',
    FALSE,
    'gpt-4o'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO summary_templates (id, name, description, system_prompt, user_prompt_template, is_default, model) 
VALUES (
    '00000000-0000-0000-0000-000000000012',
    'Resumo Técnico',
    'Para reuniões técnicas com foco em decisões de arquitetura/código',
    'Você é um arquiteto de software sênior criando resumos de reuniões técnicas.
Foque em decisões técnicas, trade-offs discutidos e próximos passos de implementação.
Responda sempre em português brasileiro.',
    'Analise esta reunião técnica e crie um resumo focado em software:

## Contexto
(qual problema ou feature está sendo discutido)

## Decisões de Arquitetura
(decisões técnicas tomadas, com justificativas)

## Trade-offs Considerados
(alternativas discutidas e porque foram descartadas)

## Tasks Técnicas
- [ ] (lista de tarefas de implementação)

## Dependências / Blockers
(se mencionados)

## Tech Stack / Ferramentas Mencionadas
(tecnologias, bibliotecas, serviços)

---
TRANSCRIÇÃO:
{{transcript}}',
    FALSE,
    'gpt-4o'
)
ON CONFLICT (id) DO NOTHING;
