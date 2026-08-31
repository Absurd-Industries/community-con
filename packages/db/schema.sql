CREATE TABLE IF NOT EXISTS conferences (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description         TEXT,
  voting_opens_at     INTEGER CHECK (voting_opens_at IS NULL OR voting_opens_at >= 0),
  voting_closes_at    INTEGER CHECK (voting_closes_at IS NULL OR voting_closes_at >= 0),
  voting_force_status TEXT NOT NULL DEFAULT 'scheduled' CHECK (voting_force_status IN ('scheduled', 'open', 'closed')),
  votes_per_voter     INTEGER NOT NULL DEFAULT 0 CHECK (votes_per_voter >= 0),
  results_public      INTEGER NOT NULL DEFAULT 0 CHECK (results_public IN (0, 1)),
  speaker_visibility  TEXT NOT NULL DEFAULT 'basic' CHECK (speaker_visibility IN ('hidden', 'basic', 'full')),
  ballot_locked_at    INTEGER CHECK (ballot_locked_at IS NULL OR ballot_locked_at >= 0),
  ballot_talk_count   INTEGER CHECK (ballot_talk_count IS NULL OR ballot_talk_count >= 0),
  created_at          INTEGER NOT NULL CHECK (created_at >= 0),
  CHECK (voting_opens_at IS NULL OR voting_closes_at IS NULL OR voting_opens_at <= voting_closes_at)
);

CREATE TABLE IF NOT EXISTS slot_types (
  id               TEXT PRIMARY KEY,
  conference_id    TEXT NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes > 0),
  count            INTEGER NOT NULL CHECK (count > 0)
);

CREATE TABLE IF NOT EXISTS talks (
  id               TEXT PRIMARY KEY,
  conference_id    TEXT NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
  presenter_name   TEXT NOT NULL,
  presenter_bio    TEXT,
  presenter_email  TEXT,
  talk_type        TEXT,
  cfp_url          TEXT,
  cfp_content      TEXT,
  "references"     TEXT,
  withdrawn_at      INTEGER CHECK (withdrawn_at IS NULL OR withdrawn_at >= 0),
  withdrawal_reason TEXT,
  created_at       INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE TABLE IF NOT EXISTS voters (
  id            TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  created_at    INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  created_at    INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE TABLE IF NOT EXISTS votes (
  id        TEXT PRIMARY KEY,
  voter_id  TEXT NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
  talk_id   TEXT NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  cast_at   INTEGER NOT NULL CHECK (cast_at >= 0),
  UNIQUE(voter_id, talk_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id             TEXT PRIMARY KEY,
  admin_user_id  TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  action         TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      TEXT,
  details        TEXT,
  created_at     INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE TABLE IF NOT EXISTS organizer_tie_breaks (
  id               TEXT PRIMARY KEY,
  conference_id    TEXT NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  selected_talk_id TEXT NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  tied_talk_ids    TEXT NOT NULL,
  reason           TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  admin_user_id    TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at       INTEGER NOT NULL CHECK (created_at >= 0)
);
