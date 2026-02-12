# DecisionDesk Desktop (macOS — Electron + React)

Aplicativo desktop para processamento local de transcrições usando whisper.cpp.

## Features

- 🎯 **Fila de Transcrição** - Recebe jobs do servidor e processa localmente
- 🔒 **Privacidade Total** - Áudio nunca sai do seu Mac
- 💰 **Custo Zero** - Usa whisper.cpp local, sem API paga
- 🚀 **M3 Max Otimizado** - ~15x realtime com large-v3

## Requisitos

- **macOS** 12+ (Apple Silicon recomendado)
- **whisper.cpp** compilado e instalado
- **Modelos GGML** baixados

## Instalação do whisper.cpp

```bash
# Clone e compile whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make

# Copie o binário (ou adicione ao PATH)
sudo cp main /usr/local/bin/whisper

# Baixe modelos (na pasta ~/.whisper/models/)
mkdir -p ~/.whisper/models
cd ~/.whisper/models

# Large-v3 (recomendado para M3 Max)
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin

# Medium (para M1/M2 ou processamento mais rápido)
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin

# Small (para máquinas mais modestas)
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Iniciar em modo desenvolvimento
npm run dev

# Build para produção
npm run build:mac:arm64
```

## Configuração

O aplicativo procura por:
- **Whisper**: `/opt/homebrew/bin/whisper` (dev) ou bundled (prod)
- **Modelos**: `~/.whisper/models/` (dev) ou bundled (prod)

Configurações persistidas em `~/Library/Application Support/DecisionDesk/config.json`:
- `apiUrl` - URL do servidor backend
- `whisperModel` - Modelo padrão (large-v3)
- `enableDiarization` - Identificação de falantes
- `autoAcceptJobs` - Processar automaticamente
- `notificationsEnabled` - Notificações de novos jobs

## Arquitetura

```
src/
├── main/           # Processo principal Electron
│   ├── index.ts    # Entry point, IPC handlers
│   ├── whisper.ts  # WhisperService - executa whisper.cpp
│   ├── queue.ts    # QueueService - gerencia fila
│   └── api.ts      # ApiService - comunicação com backend
├── preload/        # Bridge para renderer
│   └── index.ts    # IPC expostos ao renderer
└── renderer/       # Interface React
    ├── App.tsx     # Layout principal
    └── screens/    # QueueScreen, SettingsScreen
```

## Fluxo de Processamento

1. **Poll** - App busca jobs pendentes no backend a cada 10s
2. **Accept** - Usuário (ou auto) aceita job
3. **Download** - Baixa áudio do backend
4. **Transcribe** - whisper.cpp processa localmente
5. **Submit** - Envia resultado de volta ao backend
6. **Cleanup** - Remove áudio local

## API Endpoints (Backend)

- `GET /api/v1/desktop/queue` - Lista jobs pendentes
- `POST /api/v1/desktop/queue/{id}/accept` - Aceita job
- `GET /api/v1/desktop/queue/{id}/audio` - Download áudio
- `POST /api/v1/desktop/queue/{id}/result` - Envia resultado

