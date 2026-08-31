-- Local development seed data.
-- This intentionally does not touch admin_users so the first real signed-in user
-- can still become the bootstrap admin.

DELETE FROM audit_logs;
DELETE FROM organizer_tie_breaks;
DELETE FROM votes;
DELETE FROM voters;
DELETE FROM slot_types;
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
  ballot_locked_at,
  ballot_talk_count,
  created_at
) VALUES (
  'conf_test',
  'Community Con — IndiaFOSS 2026',
  'A seeded conference for testing the CFP voting workflow.',
  1767225600000,
  1893456000000,
  'open',
  5,
  0,
  1767225600000,
  8,
  1767225600000
);

INSERT INTO talks (
  id,
  conference_id,
  title,
  description,
  duration_minutes,
  presenter_name,
  presenter_bio,
  presenter_email,
  created_at
) VALUES
  ('talk_local_first', 'conf_test', 'Local-first Product Engineering', 'How to build fast tools that keep working when the network is unreliable.', 0, 'Anika Rao', 'Staff engineer focused on offline-first collaboration tools.', 'anika@example.com', 1767225601000),
  ('talk_design_ops', 'conf_test', 'Design Ops for Small Teams', 'Practical systems for keeping product quality high without slowing shipping.', 0, 'Marcus Lee', 'Design systems lead and former founder.', 'marcus@example.com', 1767225602000),
  ('talk_edge_runtime', 'conf_test', 'Running Apps at the Edge', 'Lessons from moving API workflows closer to users.', 0, 'Priya Menon', 'Platform engineer working on distributed runtimes.', 'priya@example.com', 1767225603000),
  ('talk_ai_eval', 'conf_test', 'Evaluating AI Features Before Launch', 'A field guide to testing AI product behavior before it reaches customers.', 0, 'Sam Carter', 'Product engineer specializing in AI evaluation systems.', 'sam@example.com', 1767225604000),
  ('talk_accessibility', 'conf_test', 'Accessibility as a Release Habit', 'How to make accessibility checks part of everyday delivery.', 0, 'Nora Patel', 'Accessibility consultant and frontend engineer.', 'nora@example.com', 1767225605000),
  ('talk_incident_review', 'conf_test', 'Incident Reviews Without Blame', 'Turning outages into better engineering systems.', 0, 'Diego Silva', 'SRE manager focused on learning culture.', 'diego@example.com', 1767225606000),
  ('talk_data_contracts', 'conf_test', 'Data Contracts That Actually Work', 'How teams can prevent analytics and pipeline breakage with lightweight contracts.', 0, 'Mei Chen', 'Data platform engineer.', 'mei@example.com', 1767225607000),
  ('talk_fast_react', 'conf_test', 'Keeping React Apps Fast', 'Pragmatic performance patterns for everyday product interfaces.', 0, 'Jordan Kim', 'Frontend performance engineer.', 'jordan@example.com', 1767225608000);

INSERT INTO voters (id, clerk_user_id, email, created_at) VALUES
  ('voter_01', 'seed_voter_01', 'voter01@example.com', 1767225610000),
  ('voter_02', 'seed_voter_02', 'voter02@example.com', 1767225611000),
  ('voter_03', 'seed_voter_03', 'voter03@example.com', 1767225612000),
  ('voter_04', 'seed_voter_04', 'voter04@example.com', 1767225613000),
  ('voter_05', 'seed_voter_05', 'voter05@example.com', 1767225614000),
  ('voter_06', 'seed_voter_06', 'voter06@example.com', 1767225615000),
  ('voter_07', 'seed_voter_07', 'voter07@example.com', 1767225616000),
  ('voter_08', 'seed_voter_08', 'voter08@example.com', 1767225617000),
  ('voter_09', 'seed_voter_09', 'voter09@example.com', 1767225618000),
  ('voter_10', 'seed_voter_10', 'voter10@example.com', 1767225619000);

INSERT INTO votes (id, voter_id, talk_id, cast_at) VALUES
  ('vote_001', 'voter_01', 'talk_local_first', 1767225700001),
  ('vote_002', 'voter_01', 'talk_ai_eval', 1767225700002),
  ('vote_003', 'voter_01', 'talk_accessibility', 1767225700003),
  ('vote_004', 'voter_01', 'talk_fast_react', 1767225700004),

  ('vote_005', 'voter_02', 'talk_local_first', 1767225701001),
  ('vote_006', 'voter_02', 'talk_design_ops', 1767225701002),
  ('vote_007', 'voter_02', 'talk_ai_eval', 1767225701003),
  ('vote_008', 'voter_02', 'talk_edge_runtime', 1767225701004),

  ('vote_009', 'voter_03', 'talk_local_first', 1767225702001),
  ('vote_010', 'voter_03', 'talk_ai_eval', 1767225702002),
  ('vote_011', 'voter_03', 'talk_incident_review', 1767225702003),
  ('vote_012', 'voter_03', 'talk_data_contracts', 1767225702004),

  ('vote_013', 'voter_04', 'talk_local_first', 1767225703001),
  ('vote_014', 'voter_04', 'talk_accessibility', 1767225703002),
  ('vote_015', 'voter_04', 'talk_fast_react', 1767225703003),

  ('vote_016', 'voter_05', 'talk_ai_eval', 1767225704001),
  ('vote_017', 'voter_05', 'talk_accessibility', 1767225704002),
  ('vote_018', 'voter_05', 'talk_edge_runtime', 1767225704003),
  ('vote_019', 'voter_05', 'talk_data_contracts', 1767225704004),

  ('vote_020', 'voter_06', 'talk_local_first', 1767225705001),
  ('vote_021', 'voter_06', 'talk_design_ops', 1767225705002),
  ('vote_022', 'voter_06', 'talk_accessibility', 1767225705003),

  ('vote_023', 'voter_07', 'talk_ai_eval', 1767225706001),
  ('vote_024', 'voter_07', 'talk_fast_react', 1767225706002),
  ('vote_025', 'voter_07', 'talk_incident_review', 1767225706003),

  ('vote_026', 'voter_08', 'talk_local_first', 1767225707001),
  ('vote_027', 'voter_08', 'talk_edge_runtime', 1767225707002),
  ('vote_028', 'voter_08', 'talk_data_contracts', 1767225707003),

  ('vote_029', 'voter_09', 'talk_ai_eval', 1767225708001),
  ('vote_030', 'voter_09', 'talk_accessibility', 1767225708002),
  ('vote_031', 'voter_09', 'talk_fast_react', 1767225708003),

  ('vote_032', 'voter_10', 'talk_design_ops', 1767225709001),
  ('vote_033', 'voter_10', 'talk_edge_runtime', 1767225709002),
  ('vote_034', 'voter_10', 'talk_incident_review', 1767225709003);
