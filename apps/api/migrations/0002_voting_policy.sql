ALTER TABLE conferences ADD COLUMN speaker_visibility TEXT NOT NULL DEFAULT 'basic'
  CHECK (speaker_visibility IN ('hidden', 'basic', 'full'));
ALTER TABLE conferences ADD COLUMN ballot_locked_at INTEGER
  CHECK (ballot_locked_at IS NULL OR ballot_locked_at >= 0);
ALTER TABLE conferences ADD COLUMN ballot_talk_count INTEGER
  CHECK (ballot_talk_count IS NULL OR ballot_talk_count >= 0);

ALTER TABLE talks ADD COLUMN withdrawn_at INTEGER
  CHECK (withdrawn_at IS NULL OR withdrawn_at >= 0);
ALTER TABLE talks ADD COLUMN withdrawal_reason TEXT;

CREATE TABLE IF NOT EXISTS organizer_tie_breaks (
  id               TEXT PRIMARY KEY,
  conference_id    TEXT NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  selected_talk_id TEXT NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  tied_talk_ids    TEXT NOT NULL,
  reason           TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  admin_user_id    TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at       INTEGER NOT NULL CHECK (created_at >= 0)
);

UPDATE conferences
SET ballot_locked_at = CAST(unixepoch('now') AS INTEGER) * 1000,
    ballot_talk_count = (
      SELECT COUNT(*) FROM talks WHERE talks.conference_id = conferences.id AND withdrawn_at IS NULL
    )
WHERE ballot_locked_at IS NULL AND (
  voting_force_status = 'open' OR (
    voting_force_status = 'scheduled'
    AND voting_opens_at IS NOT NULL
    AND voting_opens_at <= CAST(unixepoch('now') AS INTEGER) * 1000
  )
);
