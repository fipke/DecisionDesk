# Curl Recipes
# Create
curl -sX POST http://localhost:8087/api/v1/meetings -H 'Content-Type: application/json' -d '{}' | jq
# Upload (store only)
curl -s -F "file=@/path/to/sample.m4a" http://localhost:8087/api/v1/meetings/<ID>/audio | jq
# Transcribe (manual)
curl -sX POST http://localhost:8087/api/v1/meetings/<ID>/transcribe | jq
# Get
curl -s http://localhost:8087/api/v1/meetings/<ID> | jq
