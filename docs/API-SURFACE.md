# API Surface (MVP)
- Health
- Meetings: POST /meetings, POST /meetings/{id}/audio, POST /meetings/{id}/transcribe, GET /meetings/{id}
- PR03 mobile utiliza os endpoints acima (manual `/transcribe` após upload)
- Desktop-local (later): GET /meetings/{id}/audio, POST /meetings/{id}/transcript
- Queue (later): POST /meetings/{id}/queue, GET /queue?deviceId=..., POST /queue/{jobId}/accept
