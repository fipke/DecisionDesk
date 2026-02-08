---
"backend": minor
---

Bootstrap the Spring Boot API with API versioning, PostgreSQL connectivity, Flyway baseline migration, OpenAPI UI, and Whisper cost scaffolding.

## Runbook
- Configure environment variables via `.env` as outlined in `apps/backend/README.md`.
- Launch PostgreSQL locally with `podman-compose up postgres`.
- Start the API from `apps/backend` using `mvn spring-boot:run` (or `./mvnw spring-boot:run`).
- Verify `/api/v1/health` responds with status, version, and timestamp.
- Execute `mvn test` to run the backend test suite.
