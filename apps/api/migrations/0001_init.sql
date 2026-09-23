-- Communi-Con voting system.
--
-- There are no accounts here and no table of people. A ballot carries a hash of
-- the voter's ticket ID and email, computed in their browser; the ticket and the
-- email themselves never reach this database. That is the whole privacy
-- guarantee, and it is enforced by there being nowhere to put them.

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

CREATE TABLE IF NOT EXISTS talks (
  id                TEXT PRIMARY KEY,
  conference_id     TEXT NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  duration_minutes  INTEGER NOT NULL CHECK (duration_minutes >= 0),
  presenter_name    TEXT NOT NULL,
  presenter_bio     TEXT,
  presenter_email   TEXT,
  talk_type         TEXT,
  cfp_url           TEXT,
  cfp_content       TEXT,
  "references"      TEXT,
  withdrawn_at      INTEGER CHECK (withdrawn_at IS NULL OR withdrawn_at >= 0),
  withdrawal_reason TEXT,
  created_at        INTEGER NOT NULL CHECK (created_at >= 0)
);

-- Append-only. A voter changing their mind inserts a new row; nothing here is
-- ever updated or deleted, so the log of what was submitted when is the audit
-- trail. The tally decides which rows count.
--
-- There is deliberately NO unique constraint on voter_hash: enforcing one would
-- make a rejected insert tell the sender that hash had voted before, which is
-- exactly the oracle this design avoids.
CREATE TABLE IF NOT EXISTS ballots (
  id            TEXT PRIMARY KEY,
  conference_id TEXT NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  voter_hash    TEXT NOT NULL CHECK (length(voter_hash) = 64),
  -- A JSON array of talk ids. One row per ballot, not per pick, because the
  -- ballot is the thing that gets superseded.
  talk_ids      TEXT NOT NULL,
  cast_at       INTEGER NOT NULL CHECK (cast_at >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ballots_conference ON ballots(conference_id, cast_at);
CREATE INDEX IF NOT EXISTS idx_ballots_voter ON ballots(conference_id, voter_hash);

-- The official list of claimed tickets, hashed the same way the vote page hashes
-- them. Uploaded by an organiser at tally time. Empty means "no list yet", and
-- every ballot counts until there is one.
CREATE TABLE IF NOT EXISTS valid_voters (
  conference_id TEXT NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  voter_hash    TEXT NOT NULL CHECK (length(voter_hash) = 64),
  uploaded_at   INTEGER NOT NULL CHECK (uploaded_at >= 0),
  PRIMARY KEY (conference_id, voter_hash)
);

CREATE TABLE IF NOT EXISTS organizer_tie_breaks (
  id               TEXT PRIMARY KEY,
  conference_id    TEXT NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  selected_talk_id TEXT NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  tied_talk_ids    TEXT NOT NULL,
  reason           TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  -- Who did it, as they typed it. There are no accounts to point at.
  admin_label      TEXT NOT NULL DEFAULT 'organiser',
  created_at       INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  admin_label TEXT NOT NULL DEFAULT 'organiser',
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT,
  details     TEXT,
  created_at  INTEGER NOT NULL CHECK (created_at >= 0)
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
