# PR02 Patch — Manual Transcribe
- Add AUTO_TRANSCRIBE_ON_UPLOAD flag (must remain false; backend rejects true)
- POST /meetings/{id}/audio is store-only and returns { status: "NEW" }
- Add POST /meetings/{id}/transcribe reusing the same service
- Update OpenAPI; add smoke tests
