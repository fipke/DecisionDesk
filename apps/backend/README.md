# DecisionDesk Backend

This module hosts the Spring Boot API for DecisionDesk. Follow the steps below to configure the environment, run the service locally, and execute the test suite.

## Prerequisites
- **Java 21** (matching the `java.version` in `pom.xml`).
- **Maven 3.9+** or use the included Maven Wrapper (`./mvnw`).

## Setup
1. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and populate `OPENAI_API_KEY` with a valid key. The application binds this value into `OpenAiProperties` at startup.

## Running the API
From `apps/backend`, start the Spring Boot application:
```bash
mvn spring-boot:run
```

Once the service is running, verify the health endpoint:
```bash
curl http://localhost:8080/api/v1/health
```

OpenAPI documentation is exposed at `http://localhost:8080/swagger-ui.html`.

## Testing
Execute the backend unit tests with:
```bash
mvn test
```

Use `./mvnw` in place of `mvn` if you prefer the provided Maven Wrapper (requires outbound network access on first run).
