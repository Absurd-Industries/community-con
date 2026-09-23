-- Throwaway proposals, for clicking around a local database.
--
-- Every name and talk below is invented. NEVER load this into the live
-- database: a real ballot showing made-up speakers is worse than an empty one.
--
--   npm run db:seed:local
--   wrangler d1 execute community-con --local --file packages/db/demo-talks.sql
--
-- There are 12 of these on purpose. The seeded vote budget is 7, and the API
-- refuses to open voting when the budget exceeds the number of talks on the
-- ballot - so a demo set smaller than 7 cannot be voted on at all.

INSERT INTO talks (id, conference_id, title, description, duration_minutes, presenter_name, presenter_bio, talk_type, created_at) VALUES
  ('demo_1',  'conf_communi_con_2026', 'Your Raspberry Pi is a router now', 'Ten minutes, one Pi, and a working BGP-speaking edge router. What breaks first, what breaks worst, and why the answer is almost always the SD card.', 10, 'Meera Raghunathan', 'Network engineer. Runs a small WISP in the Nilgiris.', 'Infrastructure', 1),
  ('demo_2',  'conf_communi_con_2026', 'I read the kernel''s RNG so you don''t have to', 'A tour of drivers/char/random.c after the 2022 rewrite, and what still surprises people.', 10, 'Anirban Dasgupta', 'Security researcher, occasional kernel janitor.', 'Deep dive', 2),
  ('demo_3',  'conf_communi_con_2026', 'Packaging Python for Debian in 2026', 'pyproject.toml won. Debian packaging did not get easier. An honest account of the gap.', 10, 'Fatima Sheikh', 'Debian Developer since 2019.', 'Tooling', 3),
  ('demo_4',  'conf_communi_con_2026', 'A tiny CRDT in 200 lines of Rust', 'Live-coded from an empty file: a last-writer-wins map that actually converges.', 10, 'Karthik Venkatesan', 'Builds collaborative editors. Mostly for fun.', 'Deep dive', 4),
  ('demo_5',  'conf_communi_con_2026', 'Reverse-engineering my electricity meter', 'The capture, the protocol, the Python, and the very awkward email I sent the utility afterwards.', 10, 'Devendra Pawar', 'Hardware hacker. Has voided many warranties.', 'Hardware', 5),
  ('demo_6',  'conf_communi_con_2026', 'How we got 40,000 school students onto FOSS', 'The logistics nobody writes blog posts about: hardware refresh cycles, teacher buy-in, and year three when the budget changed.', 10, 'Sreelakshmi Nair', 'Teacher trainer with a state IT programme.', 'Community', 6),
  ('demo_7',  'conf_communi_con_2026', 'Postgres full-text search is enough', 'Before you add a search cluster: what tsvector actually does, and the three queries that decide whether you need more.', 10, 'Ritu Malhotra', 'Backend engineer. Deletes more code than she writes.', 'Databases', 7),
  ('demo_8',  'conf_communi_con_2026', 'Running a mesh network in a monsoon', 'Two years of rooftop radios, water ingress, and the antenna mount that finally worked.', 10, 'Joseph Mathew', 'Community network operator.', 'Infrastructure', 8),
  ('demo_9',  'conf_communi_con_2026', 'Typesetting Indic scripts without tears', 'Why your PDF renders Malayalam wrong, and the font stack that fixes it.', 10, 'Lakshmi Iyer', 'Typographer and font engineer.', 'Design', 9),
  ('demo_10', 'conf_communi_con_2026', 'I maintained an abandoned package for a year', 'What happens when you answer one issue: burnout, funding, and handing it over properly.', 10, 'Tarun Bhatia', 'Open source maintainer.', 'Community', 10),
  ('demo_11', 'conf_communi_con_2026', 'Debugging with eBPF, live', 'Attaching a probe to a running process on stage. Nothing is pre-recorded, which may be a mistake.', 10, 'Nandita Rao', 'Systems engineer.', 'Deep dive', 11),
  ('demo_12', 'conf_communi_con_2026', 'A FOSS stack for a 12-bed rural clinic', 'Inventory, records and billing on hardware that predates the staff. What we kept and what we threw out.', 10, 'Imran Qureshi', 'Builds health systems for small clinics.', 'Community', 12);
