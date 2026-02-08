# DecisionDesk Backend

This module hosts the Spring Boot API for DecisionDesk. Follow the steps below to configure the environment, connect to PostgreSQL with Flyway migrations, run the service locally, and execute the test suite.

## Prerequisites
- **Java 21** (matching the `java.version` in `pom.xml`).
- **Maven 3.9+** or use the provided Maven Wrapper (`./mvnw`).
- **Docker** for running the local PostgreSQL instance (`docker compose`).

## Setup
1. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and populate the variables defined in [docs/ENV.md](../../docs/ENV.md). Required values:
   - `OPENAI_API_KEY` – Whisper/GPT credentials (backend only).
   - `MAX_UPLOAD_MB` – upload ceiling enforced by `/meetings/{id}/audio`.
   - `AUDIO_STORAGE_ROOT` – filesystem path for persisted audio (e.g. `var/storage/audio`).
3. (Optional) Review `config/application.yml.example` for the full Spring configuration (Flyway, storage, multipart limits).

## Running the API
1. From the repository root start PostgreSQL:
   ```bash
   docker compose up postgres
   ```
2. In a new terminal, launch the Spring Boot application from `apps/backend`:
   ```bash
   mvn spring-boot:run
   ```
   Flyway will apply `db/migration/V1__baseline.sql` on startup.
3. Once the service is running, exercise the API:
   ```bash
   # Health probe
   curl http://localhost:8080/api/v1/health

   # Create a meeting shell
   curl -sX POST http://localhost:8080/api/v1/meetings | jq

   # Upload audio (replace placeholders)
   # Supports: .m4a, .mp3, .wav, .aac, .webm, .ogg, .opus
   curl -s -F "file=@/path/to/sample.m4a" \
     http://localhost:8080/api/v1/meetings/<MEETING_ID>/audio | jq

   # Trigger transcription manually
   curl -sX POST http://localhost:8080/api/v1/meetings/<MEETING_ID>/transcribe | jq

   # Fetch meeting status/transcript/costs
   curl -s http://localhost:8080/api/v1/meetings/<MEETING_ID> | jq
   ```
4. OpenAPI documentation (SpringDoc) is exposed at `http://localhost:8080/swagger-ui.html`.

## Testing
Execute the backend unit tests with:
```bash
mvn test
```

Use `./mvnw` in place of `mvn` if you prefer the provided Maven Wrapper (requires outbound network access on first run).
