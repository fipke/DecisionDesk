-- V9: Structured transcript segments with speaker identification
--
-- Stores per-segment data (timestamps, text, speaker) produced by Whisper + PyAnnote diarization.
-- Replaces the flat transcript text for interactive transcript viewing, click-to-seek, speaker management.

CREATE TABLE IF NOT EXISTS meeting_speakers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id    UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    label         TEXT NOT NULL,
    display_name  TEXT,
    person_id     UUID REFERENCES people(id) ON DELETE SET NULL,
    color_index   INTEGER NOT NULL DEFAULT 0,
    talk_time_sec NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(meeting_id, label)
);

CREATE INDEX IF NOT EXISTS idx_meeting_speakers_meeting ON meeting_speakers(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_speakers_person ON meeting_speakers(person_id);

CREATE TABLE IF NOT EXISTS transcript_segments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id    UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    ordinal       INTEGER NOT NULL,
    start_sec     NUMERIC(10, 3) NOT NULL,
    end_sec       NUMERIC(10, 3) NOT NULL,
    text          TEXT NOT NULL,
    speaker_label TEXT,
    speaker_id    UUID REFERENCES meeting_speakers(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(meeting_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_meeting ON transcript_segments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_speaker ON transcript_segments(speaker_id);

-- Auto-update timestamp trigger for meeting_speakers
CREATE OR REPLACE FUNCTION update_meeting_speakers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meeting_speakers_updated_at
    BEFORE UPDATE ON meeting_speakers
    FOR EACH ROW
    EXECUTE FUNCTION update_meeting_speakers_timestamp();
