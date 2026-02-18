# Curl Recipes

> Base URL: `http://localhost:8087`

## Meetings
```bash
# Create
curl -sX POST http://localhost:8087/api/v1/meetings \
  -H 'Content-Type: application/json' -d '{}' | jq

# Upload audio (store only — no auto-transcribe)
curl -s -F "file=@/path/to/sample.m4a" \
  http://localhost:8087/api/v1/meetings/<ID>/audio | jq

# Transcribe (manual trigger)
curl -sX POST http://localhost:8087/api/v1/meetings/<ID>/transcribe | jq

# Get (full detail)
curl -s http://localhost:8087/api/v1/meetings/<ID> | jq

# List
curl -s http://localhost:8087/api/v1/meetings | jq
```

## Desktop Queue
```bash
# Enqueue
curl -sX POST http://localhost:8087/api/v1/desktop/queue/<MEETING_ID> \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"mac-dev","model":"large-v3","language":"pt"}' | jq

# List pending
curl -s http://localhost:8087/api/v1/desktop/queue | jq

# Accept (lock for this device)
curl -sX POST http://localhost:8087/api/v1/desktop/queue/<JOB_ID>/accept \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"mac-dev"}' | jq

# Post transcript
curl -sX POST http://localhost:8087/api/v1/desktop/queue/<JOB_ID>/transcript \
  -H 'Content-Type: application/json' \
  -d '{"text":"transcript text...","language":"pt","deviceId":"mac-dev"}' | jq
```

## Folders & People
```bash
# Create folder
curl -sX POST http://localhost:8087/api/v1/folders \
  -H 'Content-Type: application/json' \
  -d '{"name":"Clientes","parentId":null}' | jq

# Search people for @mention autocomplete
curl -s "http://localhost:8087/api/v1/people?q=Rod" | jq
```

## Summary
```bash
# Generate summary with default template
curl -sX POST http://localhost:8087/api/v1/meetings/<ID>/summaries \
  -H 'Content-Type: application/json' -d '{}' | jq

# Generate with specific template
curl -sX POST http://localhost:8087/api/v1/meetings/<ID>/summaries \
  -H 'Content-Type: application/json' \
  -d '{"templateId":"<TEMPLATE_ID>"}' | jq
```
