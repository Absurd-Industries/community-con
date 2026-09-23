-- The conference row. Nothing else.
--
-- Talk proposals are not seeded: they come from FOSS United's CFP and are
-- loaded by an organiser on /admin/talks, either one at a time or as a CSV.
-- Inventing proposals in a live database would put made-up names on a real
-- ballot, so this file refuses to do it. For a throwaway set to click around,
-- load packages/db/demo-talks.sql instead - and never into the real database.
--
-- Times below are the published Communi-Con schedule, in IST, as epoch
-- milliseconds. They match apps/web/src/lib/event.ts SCHEDULE:
--   voting opens   Sat 26 Sep 2026, 5:00 pm IST  = 1790422200000
--   voting closes  Sun 27 Sep 2026, 12:00 pm IST = 1790490600000

DELETE FROM audit_logs;
DELETE FROM organizer_tie_breaks;
DELETE FROM ballots;
DELETE FROM valid_voters;
DELETE FROM talks;
DELETE FROM conferences;

INSERT INTO conferences (
  id,
  name,
  description,
  voting_opens_at,
  voting_closes_at,
  voting_force_status,
  votes_per_voter,
  results_public,
  speaker_visibility,
  ballot_locked_at,
  ballot_talk_count,
  created_at
) VALUES (
  'conf_communi_con_2026',
  'Communi-Con',
  'Ticket holders pick the community talks. The 7 with the most votes go on stage in Hall 1, 10 minutes each.',
  1790422200000,
  1790490600000,
  -- 'scheduled' means the dates above decide. The ballot locks itself the
  -- moment voting first opens, so proposals can still be loaded until then.
  'scheduled',
  7,
  0,
  'basic',
  NULL,
  NULL,
  1790102400000
);
