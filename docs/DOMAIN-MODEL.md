# Domain Model (MVP)
Meeting(id, createdAt, status)
AudioAsset(id, meetingId, path, codec, sampleRate, sizeBytes, durationSec?)
Transcript(id, meetingId, language, text)
Summary(id, meetingId, textMd)        # entra no PR 04
UsageRecord(id, meetingId, service, units, costBrl, meta)
