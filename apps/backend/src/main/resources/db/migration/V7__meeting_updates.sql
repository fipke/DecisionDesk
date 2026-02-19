-- V7: Add deleted_at for soft deletes on meetings
ALTER TABLE meetings ADD COLUMN deleted_at TIMESTAMPTZ;

-- Index for filtering active (non-deleted) meetings
CREATE INDEX idx_meetings_deleted_at ON meetings (deleted_at) WHERE deleted_at IS NULL;
