# PR Roadmap - DecisionDesk

> Baseado na revisão de 12/02/2026 (`Review_2026_02_12.md`)

## Estratégia

**Fase 1: Backend (PR07-PR11)** - Implementar toda a lógica de negócios e APIs  
**Fase 2: UI (PR12-PR13)** - Implementar telas mobile e desktop com visão completa das features

---

## PRs Anteriores (Completos)

| PR | Descrição | Status |
|----|-----------|--------|
| PR01 | Setup inicial monorepo | ✅ Completo |
| PR02 | Meetings básico, upload, Whisper | ✅ Completo |
| PR03 | Custo Whisper | ✅ Completo |
| PR04 | Multi-provider transcription | ✅ Completo |
| PR05 | Desktop app (Electron + whisper.cpp) | ✅ Completo |
| PR06 | Mobile offline-first | ✅ Completo |

---

## Fase 1: Backend

### PR07 - Organização: Pastas, Tipos, Tags ✅
**Status:** Backend completo, precisa fix de migration

**Entregáveis:**
- [x] V2 migration (folders, meeting_types, meetings alterations)
- [x] Folder entity + repository + service + controller
- [x] MeetingType entity + repository + service + controller  
- [x] Meeting model atualizado (folderId, meetingTypeId, tags, title)
- [x] Mobile SQLite schema (folders, meeting_types tables)
- [x] Mobile TypeScript types

**Endpoints:**
- `POST/GET/PUT/DELETE /api/v1/folders`
- `POST/GET/PUT/DELETE /api/v1/meeting-types`

---

### PR08 - Pessoas (Participantes + Menções)
**Status:** Pendente

**Conceito:**
- Tabela `people` (não `participants`) - podem ser participantes da reunião OU pessoas mencionadas
- **@ Mentions no Markdown**: quando usuário digita ` @` (espaço + @) seguido de texto, ativa autocomplete
- Autocomplete busca pessoas existentes conforme digita (ex: `@Rod` → lista todos que começam com "Rod")
- Navegação com ↑/↓ e Enter para selecionar
- Última opção sempre: "Adicionar nova pessoa"
- Ao selecionar, insere referência clicável no markdown
- Clique na referência abre modal para editar detalhes (nome completo, email, notas)

**Entregáveis:**
- [ ] V3 migration (people table, meeting_people junction com tipo: participant/mentioned)
- [ ] Person entity + repository + service + controller
- [ ] Endpoint de busca com autocomplete (`GET /api/v1/people/search?q=Rod`)
- [ ] Junction table com `role`: 'participant' | 'mentioned'
- [ ] Mobile SQLite people table + sync

**Endpoints:**
- `GET /api/v1/people/search?q={query}` - autocomplete
- `POST/GET/PUT/DELETE /api/v1/people`
- `POST /api/v1/meetings/{id}/people` - associar pessoa à reunião
- `GET /api/v1/meetings/{id}/people` - listar pessoas da reunião

**Schema:**
```sql
CREATE TABLE people (
    id UUID PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,  -- nome curto para @mention
    full_name VARCHAR(200),
    email VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE TABLE meeting_people (
    meeting_id UUID REFERENCES meetings(id),
    person_id UUID REFERENCES people(id),
    role VARCHAR(20) NOT NULL, -- 'participant' | 'mentioned'
    PRIMARY KEY (meeting_id, person_id, role)
);
```

**UI Behavior:**
```
Usuário digita: "Falei com @Rod"
                         ↓ autocomplete aparece
┌─────────────────────────┐
│ 🔍 Rodrigo Silva        │ ← match
│ 🔍 Rodolfo Mendes       │
│ ➕ Adicionar "Rod"      │
└─────────────────────────┘
```

---

### PR09 - Resumos Cloud (GPT-4)
**Status:** Pendente

**Entregáveis:**
- [ ] V4 migration (summary_templates table)
- [ ] SummaryTemplate entity + repository
- [ ] GPT-4 integration para resumos
- [ ] Custo GPT tracking
- [ ] Templates de resumo por tipo de reunião

**Endpoints:**
- `POST /api/v1/meetings/{id}/summarize`
- `POST/GET/PUT/DELETE /api/v1/summary-templates`

---

### PR10 - Resumos Local (Ollama + Mistral-7B)
**Status:** Pendente

**Entregáveis:**
- [ ] Ollama integration service
- [ ] Mistral-7B model support
- [ ] Fallback: local → cloud
- [ ] Desktop: embedding Ollama ou conexão local

**Configuração:**
- Mistral-7B requer ~8GB RAM (M3 Max: ✅)
- Ollama server local em `localhost:11434`

---

### PR11 - Model Reporting + Persistent Queue
**Status:** Pendente

**Entregáveis:**
- [ ] V5 migration (usage_records enhancements)
- [ ] Relatório de uso por modelo Whisper
- [ ] Fila persistente de transcription jobs
- [ ] Retry automático para jobs falhos
- [ ] Dashboard de custos

**Endpoints:**
- `GET /api/v1/reports/model-usage`
- `GET /api/v1/reports/costs`
- `GET /api/v1/queue/status`

---

## Fase 2: UI

### PR12 - UI Mobile (React Native)
**Status:** Pendente (após PR11)

**Telas:**
- [ ] FolderListScreen (árvore de pastas)
- [ ] FolderDetailScreen (meetings na pasta)
- [ ] MeetingTypePickerModal
- [ ] TagEditorModal
- [ ] ParticipantListScreen
- [ ] ParticipantPickerModal
- [ ] SummaryViewScreen (com markdown)
- [ ] CostsDashboardScreen
- [ ] SettingsScreen (modelo default, provider, etc.)

---

### PR13 - UI Desktop (Electron)
**Status:** Pendente (após PR12)

**Telas:**
- [ ] MainWindow com sidebar de pastas
- [ ] MeetingDetailPanel
- [ ] TranscriptionQueuePanel
- [ ] LocalModelSettingsPanel (Whisper + Ollama)
- [ ] CostReportWindow

---

## Dependências do Sistema

### Backend
- Java 21, Spring Boot 4, PostgreSQL, Flyway
- OpenAI API (Whisper + GPT-4)

### Mobile
- React Native / Expo SDK 54
- SQLite (offline-first)
- expo-av (recording)

### Desktop
- Electron 33, React 19
- whisper.cpp (`/opt/homebrew/bin/whisper-cli`)
- Ollama (PR10)

### Modelos Whisper Local
```
~/.whisper/models/
├── ggml-base.bin     (141 MB)
├── ggml-small.bin    (465 MB)
├── ggml-medium.bin   (1.4 GB)
└── ggml-large-v3.bin (2.9 GB)
```

---

## Timeline Estimado

| Semana | PRs |
|--------|-----|
| S1 | PR07 fix + PR08 |
| S2 | PR09 + PR10 |
| S3 | PR11 |
| S4-S5 | PR12 + PR13 |

---

## Notas

- **Offline-first** é requisito crítico para mobile e desktop
- **Sync bidirectional** entre SQLite local e PostgreSQL
- Custos em USD e BRL (FX configurável)
- Privacidade: preferir local (whisper.cpp, Ollama) sobre cloud
