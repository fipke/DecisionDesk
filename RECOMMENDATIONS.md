# Recommendations (Non-binding)

- Backend: Spring Boot 4.0.0 + Spring Framework 7 (API versioning)
- DB: PostgreSQL; consider schema-per-tenant or tenant_id strategy
- Queue: RabbitMQ for job queues, or Redis Streams if preferred (decide during implementation)
- OpenAI: Whisper for transcription (default language pt-BR) and GPT for summaries
- Clients: Tailwind/Headless UI (Web/Electron), NativeWind (RN)

These are guidance only. Let your coding assistant select compatible versions when generating actual code.
