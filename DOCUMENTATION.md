# DecisionDesk — Documentação Completa

> **Versão**: 0.1.0 (MVP)  
> **Última atualização**: Fevereiro 2026  
> **Idioma padrão**: Português (Brasil)

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Provedores de Transcrição](#3-provedores-de-transcrição)
4. [Fluxo do Usuário](#4-fluxo-do-usuário)
5. [Estrutura do Monorepo](#5-estrutura-do-monorepo)
6. [App Mobile (iOS)](#6-app-mobile-ios)
7. [App Desktop (macOS)](#7-app-desktop-macos)
8. [Backend (Spring Boot)](#8-backend-spring-boot)
9. [Custos e Precificação](#9-custos-e-precificação)
10. [Configurações de Ambiente](#10-configurações-de-ambiente)
11. [Como Executar](#11-como-executar)
12. [Status de Implementação](#12-status-de-implementação)
13. [Roadmap](#13-roadmap)

---

## 1. Visão Geral

**DecisionDesk** é um gravador de reuniões multiplataforma com foco em privacidade e controle de custos. O sistema permite gravar áudio no iPhone, transcrever usando diferentes provedores (local ou cloud), e visualizar transcrições e custos.

### Princípios do MVP

| Regra | Descrição |
|-------|-----------|
| **Upload NÃO auto-transcreve** | O upload envia apenas o áudio. A transcrição é uma ação **manual** separada. |
| **Backend centraliza AI** | Todas chamadas OpenAI/Whisper passam pelo backend. Nunca no cliente. |
| **Offline-first** | Dados locais em SQLite. Sync quando online. |
| **Wi-Fi por padrão** | Uso de cellular é opt-in com warning de dados. |
| **PT-BR default** | Interface e idioma de transcrição padrão em português. |

### Plataformas (por prioridade)

1. **iOS** (React Native) — principal
2. **macOS** (Electron) — processamento local
3. **Web** (React) — futuro

---

## 2. Arquitetura

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  iOS App    │       │ macOS App   │       │   Web App   │
│  (RN/Expo)  │       │ (Electron)  │       │   (React)   │
└──────┬──────┘       └──────┬──────┘       └──────┬──────┘
       │                     │                     │
       │    HTTP/REST        │  HTTP/REST          │
       ▼                     ▼                     ▼
┌────────────────────────────────────────────────────────┐
│                    BACKEND (Spring Boot 4)             │
│  • API REST /api/v1/*                                  │
│  • PostgreSQL + Flyway                                 │
│  • Whisper (OpenAI API ou whisper.cpp local)          │
│  • Cálculo de custos server-side                      │
└────────────────────────────────────────────────────────┘
       │
       │ (provider = desktop_local)
       ▼
┌────────────────────────────────────────────────────────┐
│              FILA DESKTOP (Queue System)               │
│  • Jobs pendentes no backend                           │
│  • Mac faz polling, aceita job, baixa áudio           │
│  • Processa com whisper.cpp local                     │
│  • POSTa resultado de volta ao backend                │
└────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| Mobile | React Native 0.76, Expo SDK 54, SQLite, NativeWind |
| Desktop | Electron 33, React 19, TanStack Query, Tailwind CSS |
| Backend | Spring Boot 4, Java 21, PostgreSQL, Flyway |
| Transcrição | OpenAI Whisper API, whisper.cpp |

---

## 3. Provedores de Transcrição

O sistema suporta **3 provedores** de transcrição, selecionáveis pelo usuário no momento da transcrição:

### 3.1 `desktop_local` (Padrão Recomendado)

| Característica | Descrição |
|----------------|-----------|
| **Como funciona** | Áudio é enviado para uma fila. O Mac Desktop baixa e processa localmente. |
| **Custo** | **GRATUITO** |
| **Privacidade** | Máxima — áudio nunca sai da sua rede |
| **Latência** | Depende do Mac estar online e do modelo escolhido |
| **Requisito** | Mac com whisper.cpp instalado |

**Fluxo Desktop Local:**
```
iOS → Backend (enfileira) → Mac Desktop (polling) → 
Aceita job → Baixa áudio → whisper.cpp → POST resultado → Backend
```

### 3.2 `server_local`

| Característica | Descrição |
|----------------|-----------|
| **Como funciona** | Backend executa whisper.cpp no próprio servidor/VPS |
| **Custo** | **GRATUITO** (custo de infra apenas) |
| **Privacidade** | Alta — áudio fica no seu servidor |
| **Latência** | Imediata |
| **Requisito** | Servidor com whisper.cpp configurado |

### 3.3 `remote_openai`

| Característica | Descrição |
|----------------|-----------|
| **Como funciona** | Backend chama API OpenAI Whisper |
| **Custo** | **~$0.006/minuto** |
| **Privacidade** | Média — áudio vai para OpenAI |
| **Latência** | Imediata |
| **Requisito** | `OPENAI_API_KEY` configurada |

---

## 4. Fluxo do Usuário

### 4.1 Gravação (iOS)

```
1. Abrir app → Tela de Gravação
2. Tocar "Gravar" (verifica permissão microfone)
3. Gravar reunião (AAC m4a, 48kHz, mono)
4. Tocar "Parar"
5. Gravação salva localmente (SQLite + arquivo)
6. Se online (Wi-Fi), sync automático com backend
   - Meeting criado no PostgreSQL
   - Áudio uploaded para storage
7. Status: NEW (aguardando transcrição)
```

### 4.2 Transcrição (Manual)

```
1. Abrir detalhes da reunião
2. Tocar "Transcrever"
3. Modal de opções aparece:
   - Escolher provedor (desktop_local, server_local, remote_openai)
   - Escolher modelo (large-v3, medium, small, base, tiny)
   - Habilitar diarização (identificar falantes)
4. Confirmar
5. Backend processa conforme provedor escolhido
6. Quando pronto: transcript + custos salvos
```

### 4.3 Desktop Queue (para `desktop_local`)

```
1. Job chega na fila do backend
2. Mac Desktop faz polling a cada 10s
3. Job aparece na tela "Fila"
4. Usuário clica "Aceitar e Processar"
5. Mac baixa áudio do backend
6. whisper.cpp processa localmente
7. Resultado enviado de volta ao backend
8. iOS atualiza ao fazer refresh
```

---

## 5. Estrutura do Monorepo

```
DecisionDesk/
├── apps/
│   ├── backend/          # Spring Boot API
│   │   ├── src/main/java/com/decisiondesk/backend/
│   │   │   ├── api/v1/                # Controllers
│   │   │   │   ├── meetings/          # CRUD reuniões
│   │   │   │   └── desktop/           # Fila desktop
│   │   │   ├── meetings/              # Domain layer
│   │   │   │   ├── model/             # Entities (JPA)
│   │   │   │   ├── persistence/       # Repositories
│   │   │   │   └── service/           # Business logic
│   │   │   ├── cost/                  # Calculadora de custos
│   │   │   ├── openai/                # Cliente Whisper API
│   │   │   └── config/                # Configurações
│   │   └── src/main/resources/
│   │       ├── application.properties
│   │       └── db/migration/          # Flyway scripts
│   │
│   ├── mobile/           # React Native iOS
│   │   └── src/
│   │       ├── screens/               # Telas
│   │       ├── components/            # UI components
│   │       ├── services/              # API calls
│   │       ├── state/                 # Context providers
│   │       ├── storage/               # SQLite
│   │       └── types/                 # TypeScript
│   │
│   ├── desktop/          # Electron macOS
│   │   └── src/
│   │       ├── main/                  # Main process
│   │       │   ├── index.ts           # Entry point
│   │       │   ├── whisper.ts         # WhisperService
│   │       │   ├── queue.ts           # Queue manager
│   │       │   └── api.ts             # Backend client
│   │       ├── preload/               # Preload scripts
│   │       └── renderer/              # React UI
│   │           └── screens/
│   │
│   └── web/              # Web app (futuro)
│
├── packages/
│   ├── types/            # Tipos compartilhados
│   ├── utils/            # Utilitários compartilhados
│   └── prompts/          # Biblioteca de prompts (pós-MVP)
│
└── docs/                 # Documentação técnica
```

---

## 6. App Mobile (iOS)

### 6.1 Telas Implementadas

| Tela | Arquivo | Status |
|------|---------|--------|
| Lista de Reuniões | `MeetingListScreen.tsx` | ✅ Implementado |
| Detalhes da Reunião | `MeetingDetailScreen.tsx` | ✅ Implementado |
| Gravação | `RecordScreen.tsx` | ✅ Implementado |
| Configurações | `SettingsScreen.tsx` | ✅ Implementado |

### 6.2 Funcionalidades

| Feature | Status | Observação |
|---------|--------|------------|
| Gravação de áudio | ✅ | AAC m4a, 48kHz, mono |
| Armazenamento local SQLite | ✅ | Offline-first |
| Sync com backend | ✅ | Wi-Fi ou cellular opt-in |
| Transcrição manual | ✅ | Modal com opções de provedor |
| Exibição de transcrição | ✅ | Texto completo |
| Exibição de custos | ✅ | USD e BRL |
| Seleção de provedor | ✅ | 3 opções |
| Seleção de modelo | ✅ | 5 opções |
| Diarização (toggle) | ✅ | UI pronta, backend parcial |
| Pastas/Tags | ⏳ | Não iniciado |
| Pendências (checklist) | ⏳ | Não iniciado |
| Resumo automático | ⏳ | Não iniciado |

### 6.3 SQLite Schema (Local)

```sql
CREATE TABLE meetings (
  id TEXT PRIMARY KEY NOT NULL,
  remote_id TEXT,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  recording_uri TEXT,
  transcript_text TEXT,
  language TEXT,
  cost_usd REAL,
  cost_brl REAL,
  minutes REAL
);

CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

---

## 7. App Desktop (macOS)

### 7.1 Telas Implementadas

| Tela | Arquivo | Status |
|------|---------|--------|
| Fila de Jobs | `QueueScreen.tsx` | ✅ Implementado |
| Configurações | `SettingsScreen.tsx` | ✅ Implementado |

### 7.2 Funcionalidades

| Feature | Status | Observação |
|---------|--------|------------|
| Polling de jobs | ✅ | A cada 10s |
| Aceitar job | ✅ | Marca como aceito no backend |
| Download de áudio | ✅ | Via API |
| Transcrição whisper.cpp | ✅ | Modelos em `~/.whisper/models/` |
| POST resultado | ✅ | Envio de transcript |
| Seleção de modelo | ✅ | UI em Settings |
| Status de whisper | ✅ | Mostra se disponível |
| Lista de modelos | ✅ | Mostra baixados |
| Diarização local | ⏳ | Estrutura pronta, pyannote pendente |

### 7.3 Configuração whisper.cpp

```bash
# Instalação (macOS)
brew install whisper-cpp

# Modelos baixados em:
~/.whisper/models/
├── ggml-base.bin      # 142MB
├── ggml-small.bin     # 466MB
├── ggml-medium.bin    # 1.4GB
└── ggml-large-v3.bin  # 2.9GB

# Executável:
/opt/homebrew/bin/whisper-cli
```

### 7.4 Makefile

```makefile
make dev      # Desenvolvimento (hot reload)
make build    # Build produção
make run      # Build + start
make clean    # Limpar artifacts
```

---

## 8. Backend (Spring Boot)

### 8.1 Endpoints API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/meetings` | Criar reunião |
| GET | `/api/v1/meetings/{id}` | Detalhes da reunião |
| POST | `/api/v1/meetings/{id}/audio` | Upload de áudio |
| POST | `/api/v1/meetings/{id}/transcribe` | Solicitar transcrição |
| GET | `/api/v1/desktop/queue` | Listar jobs pendentes |
| POST | `/api/v1/desktop/queue/{id}/accept` | Aceitar job |
| GET | `/api/v1/desktop/queue/{id}/audio` | Download áudio |
| POST | `/api/v1/desktop/queue/{id}/result` | Enviar resultado |

### 8.2 Entidades Principais

| Entidade | Arquivo | Descrição |
|----------|---------|-----------|
| Meeting | `model/Meeting.java` | Reunião principal |
| AudioAsset | `model/AudioAsset.java` | Metadados do áudio |
| Transcript | `model/Transcript.java` | Transcrição gerada |
| UsageRecord | `model/UsageRecord.java` | Registro de custos |

### 8.3 Serviços

| Serviço | Arquivo | Status |
|---------|---------|--------|
| TranscriptionService | `service/TranscriptionService.java` | ✅ Implementado |
| LocalWhisperService | `service/ProcessBuilderWhisperService.java` | ✅ Implementado |
| DesktopQueueService | `service/InMemoryDesktopQueueService.java` | ✅ Implementado |
| WhisperCostCalculator | `cost/WhisperCostCalculator.java` | ✅ Implementado |

---

## 9. Custos e Precificação

### 9.1 Configurações

```properties
costs.whisper-price-per-min-usd=0.006    # USD/minuto OpenAI
costs.gpt-price-per-1k-prompt-usd=0.005  # Futuro
costs.gpt-price-per-1k-completion-usd=0.015  # Futuro
costs.fx-usd-brl=5.0                      # Câmbio USD→BRL
```

### 9.2 Cálculo de Custos

```java
// WhisperCostCalculator.java
BigDecimal minutes = durationMs / 60000.0
BigDecimal costUsd = minutes * WHISPER_PRICE_PER_MIN
BigDecimal costBrl = costUsd * FX_USD_BRL
```

### 9.3 Custos por Provedor

| Provedor | Custo/minuto |
|----------|--------------|
| desktop_local | R$ 0,00 |
| server_local | R$ 0,00 |
| remote_openai | ~R$ 0,03/min |

---

## 10. Configurações de Ambiente

### 10.1 Backend (.env)

```env
# Banco de dados
POSTGRES_URL=jdbc:postgresql://localhost:5432/decisiondesk
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secret

# OpenAI (opcional se usar apenas local)
OPENAI_API_KEY=sk-...

# Storage
AUDIO_STORAGE_ROOT=var/storage/audio

# Configurações
AUTO_TRANSCRIBE_ON_UPLOAD=false
DEFAULT_LANGUAGE=pt
MAX_UPLOAD_MB=200

# Provedores
TRANSCRIPTION_DESKTOP_ENABLED=true
TRANSCRIPTION_LOCAL_ENABLED=false

# Custos
WHISPER_PRICE_PER_MIN_USD=0.006
FX_USD_BRL=5.0
```

### 10.2 Mobile

```typescript
// Configurado via SettingsContext
{
  apiUrl: 'http://localhost:8087',
  allowCellular: false,
  transcription: {
    defaultProvider: 'desktop_local',
    defaultModel: 'large-v3',
    enableDiarization: false
  }
}
```

---

## 11. Como Executar

### 11.1 Backend

```bash
cd apps/backend

# Configurar .env (copiar de config/application.yml.example)

# Iniciar PostgreSQL (Docker)
docker-compose up -d

# Executar
./mvnw spring-boot:run
# ou
make dev
```

### 11.2 Mobile (iOS)

```bash
cd apps/mobile

npm install
npx expo run:ios
```

### 11.3 Desktop (macOS)

```bash
cd apps/desktop

# Instalar whisper.cpp
brew install whisper-cpp

# Baixar modelos
mkdir -p ~/.whisper/models
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin \
  -o ~/.whisper/models/ggml-large-v3.bin

# Executar
make dev
```

---

## 12. Status de Implementação

### 12.1 ✅ Implementado e Funcionando

| Componente | Descrição |
|------------|-----------|
| **Mobile: Gravação** | Captura AAC 48kHz mono |
| **Mobile: SQLite** | Armazenamento offline |
| **Mobile: Sync** | Upload automático em Wi-Fi |
| **Mobile: Transcrição Manual** | Modal com 3 provedores |
| **Desktop: Fila** | Polling + accept + process |
| **Desktop: whisper.cpp** | Integração completa |
| **Desktop: Settings** | Seleção de modelo |
| **Backend: API CRUD** | Meetings + audio + transcribe |
| **Backend: 3 Provedores** | remote_openai, server_local, desktop_local |
| **Backend: Custos** | Cálculo USD e BRL |
| **Backend: Desktop Queue** | Enqueue + dequeue + result |

### 12.2 ⚠️ Implementado mas Parcial

| Item | Arquivo | Pendência |
|------|---------|-----------|
| **Diarização** | `apps/desktop/src/main/whisper.ts` | Estrutura pronta, pyannote não integrado |
| **server_local** | `ProcessBuilderWhisperService.java` | Implementado, mas desabilitado por padrão |
| **Segments** | `whisper.ts` | Coleta timestamps, mas não persiste no backend |
| **Fila persistente** | `InMemoryDesktopQueueService.java` | Fila em memória, perde ao reiniciar backend |

### 12.3 ⏳ Não Iniciado

| Item | Descrição | Onde implementar |
|------|-----------|------------------|
| **Pastas** | Organização hierárquica de reuniões | Mobile + Backend |
| **Tags** | Etiquetas para filtro | Mobile + Backend |
| **Pendências** | Checklist de tarefas | Novo model no backend |
| **Resumo automático** | GPT para gerar resumo | `TranscriptionService.java` |
| **Participantes frequentes** | Detecção de speakers | Combinar com diarização |
| **Import/Export** | DOCX, VTT, SRT, PDF | Novo serviço backend |
| **KPIs** | Dashboard de métricas | Novo módulo |
| **Web App** | `apps/web/` | Não iniciado |
| **Multi-tenancy** | Schema por tenant | Pós-MVP |
| **WebSockets** | Updates em tempo real | Pós-MVP |
| **E2EE** | Criptografia end-to-end | Decidido não fazer (search conflita) |

### 12.4 Arquivos com TODO/Pendências

| Arquivo | Linha | Pendência |
|---------|-------|-----------|
| `apps/desktop/src/main/whisper.ts` | ~80 | Diarização com pyannote |
| `apps/backend/.../InMemoryDesktopQueueService.java` | * | Migrar para Redis/DB |
| `apps/mobile/src/storage/database.ts` | * | Adicionar tabelas folders, tags |
| `apps/backend/.../TranscriptionService.java` | ~200 | Suporte a segments |

---

## 13. Roadmap

### Fase 1 — MVP (Atual)
- [x] Gravação iOS
- [x] Upload para backend
- [x] Transcrição manual (3 provedores)
- [x] Desktop local processing
- [x] Cálculo de custos
- [ ] Diarização funcional

### Fase 2 — Organização
- [ ] Pastas hierárquicas
- [ ] Tags
- [ ] Busca full-text
- [ ] Filtros avançados

### Fase 3 — Produtividade
- [ ] Resumo automático (GPT)
- [ ] Pendências/tarefas
- [ ] Participantes frequentes
- [ ] Export PDF/DOCX

### Fase 4 — Web + Multi-user
- [ ] Web app React
- [ ] Multi-tenancy
- [ ] Teams/compartilhamento
- [ ] WebSockets para real-time

---

## Anexos

### A. Modelos Whisper Disponíveis

| Modelo | Tamanho | Precisão | Velocidade |
|--------|---------|----------|------------|
| tiny | 75MB | Básica | ~150x realtime |
| base | 142MB | Aceitável | ~100x realtime |
| small | 466MB | Boa | ~45x realtime |
| medium | 1.5GB | Ótima | ~30x realtime |
| large-v3 | 2.9GB | Melhor | ~15x realtime |

### B. Status Codes da API

| Status | Descrição |
|--------|-----------|
| `PENDING_SYNC` | Aguardando upload (local apenas) |
| `NEW` | Uploaded, aguardando transcrição |
| `QUEUED` | Em fila para desktop |
| `PROCESSING` | Transcrição em andamento |
| `DONE` | Completo |
| `ERROR` | Erro na transcrição |

---

*Documentação gerada em Fevereiro 2026. Para atualizações, consulte o repositório.*
