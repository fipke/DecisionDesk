-- V6: Transcription Queue for Desktop App
-- Persistent queue for desktop-local transcription jobs

CREATE TABLE transcription_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    audio_path TEXT NOT NULL,
    model VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL,
    enable_diarization BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_meeting_queue UNIQUE(meeting_id)
);

CREATE INDEX idx_transcription_queue_status ON transcription_queue(status);
CREATE INDEX idx_transcription_queue_meeting ON transcription_queue(meeting_id);
CREATE INDEX idx_transcription_queue_created ON transcription_queue(created_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_transcription_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transcription_queue_updated_at
    BEFORE UPDATE ON transcription_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_transcription_queue_timestamp();

COMMENT ON TABLE transcription_queue IS 'Queue for desktop-local transcription jobs';
COMMENT ON COLUMN transcription_queue.status IS 'Job status: PENDING, ACCEPTED, PROCESSING, COMPLETED, FAILED, CANCELLED';
COMMENT ON COLUMN transcription_queue.retry_count IS 'Number of retry attempts for failed jobs';
