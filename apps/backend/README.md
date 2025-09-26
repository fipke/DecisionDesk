# DecisionDesk Backend (MVP)
- Spring Boot 4 / Spring 7 (API versioning). No multitenancy/queues/WS/chunked in MVP.
- Endpoints: create meeting, single-file upload, backend calls Whisper, get status/cost/transcript.
- Costs: track Whisper minutes; GPT costs added when summaries arrive (PR 04).
- **Never expose or require OpenAI keys on clients.**
