# Getting Started with DecisionDesk

This guide walks you through starting the entire DecisionDesk stack from scratch.

## Prerequisites

- **Java 21** (for backend)
- **Maven 3.9+** (or use `./mvnw`)
- **Podman** (for PostgreSQL)
- **Node.js 18+** (for mobile app)
- **Expo CLI** (`npm install -g expo-cli`)
- **Xcode** (for iOS simulator)
- **OpenAI API key** (for Whisper transcription)

## Quick Start (5 steps)

> **💡 Tip**: Use `make setup` for automated setup, or run `make help` to see all available commands.

### 1. Clone & Navigate
```bash
git clone <your-repo>
cd DecisionDesk
```

### 2. Setup Environment

**Backend** (`apps/backend/.env`):
```bash
cd apps/backend
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

Required variables in `.env`:
```env
OPENAI_API_KEY=sk-...your-key-here...
MAX_UPLOAD_MB=25
AUDIO_STORAGE_ROOT=var/storage/audio
WHISPER_USD_PER_MINUTE=0.006
FX_RATE_USD_TO_BRL=5.50
```

**Mobile** (optional, for custom backend URL):
```bash
cd apps/mobile
# Create .env if needed
echo "EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1" > .env
```

### 3. Start PostgreSQL
From repository root:
```bash
podman-compose up -d postgres
# Or simply: make db-start
```

Verify it's running:
```bash
podman-compose ps
# Or: make db-logs
```

> PostgreSQL runs on **port 5435** to avoid conflicts with other local instances.

# Or from root: make backend-run
### 4. Start Backend API
From `apps/backend`:
```bash
mvn spring-boot:run
```

Wait for startup, then test:
```bash
# Health check
curl http://localhost:8080/api/v1/health

# Test OpenAI connection
curl http://localhost:8080/api/v1/debug/openai-test
```

Backend runs at: **http://localhost:8080**  
OpenAPI docs: **http://localhost:8080/swagger-ui.html**

### 5. Start iOS Mobile App
From `apps/mobile`:
```bash
npm install
npx expo start
```

Press `i` to open iOS simulator.

---

## Testing the Full Flow

### Backend-only test (with curl)

1. **Create meeting**:
   ```bash
   MEETING_ID=$(curl -sX POST http://localhost:8080/api/v1/meetings | jq -r '.id')
   echo $MEETING_ID
   ```

2. **Upload audio** (replace with your file):
   ```bash
   curl -s -F "file=@/path/to/sample.m4a" \
     http://localhost:8080/api/v1/meetings/$MEETING_ID/audio | jq
   ```

3. **Trigger transcription**:
   ```bash
   curl -sX POST http://localhost:8080/api/v1/meetings/$MEETING_ID/transcribe | jq
   ```

4. **Get transcript & costs**:
   ```bash
   curl -s http://localhost:8080/api/v1/meetings/$MEETING_ID | jq
   ```

### iOS app test

1. Open app in simulator
2. Tap **"Nova gravação"**
3. Tap **"Gravar agora"** and speak
4. Tap **"Parar e salvar"**
5. From meeting list, tap the new meeting
6. Tap **"Transcrever agora"**
7. Pull to refresh to see transcript

---

## Troubleshooting

### Backend won't start
- **PostgreSQL not running**: `make db-start` or `podman-compose up -d postgres`
- **Missing OPENAI_API_KEY**: Check `apps/backend/.env`
- **Port 8080 in use**: `lsof -ti:8080 | xargs kill -9`
- **Port 5435 in use**: `lsof -ti:5435` (kill that process or change port in docker-compose.yml)

### OpenAI connection fails
```bash
# Test connection
curl http://localhost:8080/api/v1/debug/openai-test

# Check logs
cd apps/backend
tail -f target/spring-boot.log
```

### Mobile app can't connect to backend
- **Backend not running**: Start backend first
- **Wrong URL**: Update `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env`
- **iOS simulator networking**: Use `http://localhost:8080` (not `127.0.0.1`)

### Expo errors after dependency upgrade
```bash
cd apps/mobile
rm -rf node_modules package-lock.json
npm install
npx expo start -c  # Clear cache
```

---

## Development Workflow

### Backend (Java/Spring Boot)
```bash
cd apps/backend

# Run tests
mvn test

# Build without tests
mvn clean package -DskipTests

# View Flyway migration info
mvn flyway:info

# Hot reload (use Spring DevTools or restart)
mvn spring-boot:run
```

### Mobile (Expo/React Native)
```bash
cd apps/mobile

# Run tests
npm test

# Type check
npx tsc --noEmit

# iOS simulator
npx expo start
# Then press 'i'

# Clear cache if issues
npx expo start -c
```

---

## Stopping Everything

```bash
# Stop backend (Ctrl+C in terminal)

# Stop PostgreSQL
podman-compose down
# Or: make db-stop

# Stop Expo (Ctrl+C in terminal)
```

---

## Next Steps

- **PR 04 (macOS desktop)**: Electron app for viewing meetings
- **PR 05/06 (local transcription)**: Process audio on Mac instead of OpenAI
- **PR 07 (GPT summaries)**: Add meeting summaries
- **PR 08 (Web client)**: React web interface

See [docs/ROADMAP.md](docs/ROADMAP.md) for full feature timeline.
