# Environment Variables

> Full reference: `apps/backend/config/application.yml.example`  
> Local overrides: `apps/backend/src/main/resources/application.properties` (not committed)

## Backend (Spring Boot)

| Variable | Default | Required | Notes |
|----------|---------|----------|-------|
| `SPRING_DATASOURCE_URL` | — | ✅ | `jdbc:postgresql://localhost:5435/decisiondesk` |
| `SPRING_DATASOURCE_USERNAME` | — | ✅ | |
| `SPRING_DATASOURCE_PASSWORD` | — | ✅ | |
| `AUTO_TRANSCRIBE_ON_UPLOAD` | `false` | — | **Must stay false in all envs**; backend 400s if true |
| `TRANSCRIBE_PROVIDER` | `remote_openai` | — | `remote_openai` \| `server_local` \| `desktop_local` |
| `OPENAI_API_KEY` | — | ✅ (remote_openai) | Never log or expose |
| `WHISPER_MODEL` | `whisper-1` | — | OpenAI model name |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | — | Override for proxies |
| `WHISPER_USD_PER_MINUTE` | `0.006` | — | Cost computation |
| `GPT_USD_PER_1K_INPUT` | `0.00015` | — | gpt-4o-mini pricing |
| `GPT_USD_PER_1K_OUTPUT` | `0.0006` | — | |
| `BRL_PER_USD` | `5.0` | — | FX rate for BRL display |
| `AUDIO_MAX_BYTES` | `524288000` | — | 500 MB upload cap |
| `AUDIO_STORAGE_PATH` | `var/storage` | — | Absolute path outside webroot |
| `SERVER_PORT` | `8087` | — | |
| `DESKTOP_QUEUE_SCHEDULER_ENABLED` | `true` | — | Enables queue poller |
| `DESKTOP_QUEUE_POLL_SECONDS` | `30` | — | Job timeout check interval |
| `DESKTOP_QUEUE_JOB_TIMEOUT_MINUTES` | `60` | — | |

## Mobile (Expo React Native)

| Variable | Default | Notes |
|----------|---------|-------|
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:8087/api/v1` | Must use LAN IP for device/simulator |

## Desktop (Electron)

Desktop reads server URL from user settings stored in SQLite `user_preferences`.  
Default: `http://localhost:8087`
