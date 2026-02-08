---
"backend": minor
---

Bootstrap the Spring Boot API foundation with health check, OpenAPI docs, OpenAI configuration, and Whisper cost scaffolding.

## Runbook
- Configure environment variables via `.env` as outlined in `apps/backend/README.md`.
- Start the API with `mvn spring-boot:run` (or `./mvnw spring-boot:run`).
- Verify `/api/v1/health` responds successfully.
- Execute `mvn test` to run the backend test suite.
