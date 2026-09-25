# HANDOFF

Where the build actually stands, for whoever picks this up next.
Last updated: 2026-09-23.

## What this is

A voting system for Communi-Con at IndiaFOSS 2026. Ticket holders pick the
community talks; the 7 with the most votes get a 10-minute slot in Hall 1.

Run by Absurd Industries, an independent community. Not a FOSS United property,
and the site must never look like one.

## Status per deliverable

| Deliverable | State | Verified by |
| --- | --- | --- |
| Backend API (Worker + D1) | Done, deployed | 27 live checks, see below |
| Ballot storage and the tally rule | Done | 42 API tests + 37 db tests |
| Organiser password | Done | live 401 / 200 check |
| Frontend wired to the real API | Done | `npm run build`, live pages 200 |
| Voter's hash shown to them | Done | live page screenshot |
| Ballot rate limit | Done | 4 tests incl. fail-open |
| Talks CSV import + export | Done | 9 tests; live round-trip |
| Talk proposals loaded | **Not done**: database is empty | row count query |
| Official ticket list | **Not done**: arrives at tally time | n/a |

**Live:** https://community-con.forsakenlegacy.workers.dev (the only voting URL; Balu's
original `balub997` deployment should be closed so votes cannot split across two sites)
**Database:** D1 `community-con`, id `622c0123-3808-4723-b554-8224de5360e7`, APAC.
**Organiser password:** a Cloudflare secret, held by Amit. Rotate with
`npx wrangler secret put ADMIN_PASSWORD`.

## How it works, in one pass

A voter types their ticket ID and email. The browser hashes them together and
sends only the hash:

```
voter_hash = SHA256_hex( upper(trim(ticket)) + "+" + lower(trim(email)) )
```

The server never sees the ticket or the email, so it cannot tell a real voter
from an invented one, and deliberately does not try. Every ballot is accepted,
appended with a timestamp, and nothing is decided until the tally.

At tally time an organiser pastes the official list of claimed tickets. The
browser hashes those pairs the same way and sends the hashes. The server drops
ballots whose hash is not on the list, keeps the latest ballot per remaining
voter, and counts what is left.

That rule lives in one place (`packages/db/src/ballot.ts` `tallyBallots`) and
is imported by both the Worker and the browser, so the organiser's preview and
the real count cannot drift apart.

## Environment as actually built

- One Cloudflare Worker, `community-con`, serves both the site and the API.
  `/api/*` runs the Worker; everything else is a static file from
  `apps/web/dist` with an SPA fallback. One origin, so there is no CORS.
- `run_worker_first: ["/api/*"]` in `wrangler.jsonc` is load-bearing. Without
  it the SPA fallback answers `/api/*` with `index.html` and the Worker never
  sees an API request.
- D1 database `community-con`, id `622c0123-3808-4723-b554-8224de5360e7`,
  region APAC, on the forsakenlegacy account.
- `ADMIN_PASSWORD` is a Worker secret, not a var. An unset secret makes every
  organiser route return 503 rather than opening the door.
- wrangler 4.112 locally; the installed Workers runtime caps the compatibility
  date at 2024-12-30 in tests and prints a warning. Harmless.

## Fragile findings

- **Vote budget vs. talk count.** The API refuses to open voting when
  `votes_per_voter` exceeds the number of talks on the ballot. The seeded budget
  is 7, so a ballot with fewer than 7 talks cannot be opened. This cost an hour
  of confused debugging: the symptom was "no ballots in the export", because
  every vote had silently been refused with 409 after the open call returned
  422. `packages/db/demo-talks.sql` therefore ships 12 talks, not 5.
- **The ballot locks itself** the first time voting opens, and stays locked.
  Talks cannot be added, edited or deleted after that, only withdrawn. Load the
  proposals *before* Sat 26 Sep 17:00 IST.
- **`reset-ballot` clears the schedule too.** It sets the force status to
  `closed` and nulls both dates. After running it, re-apply `packages/db/seed.sql`
  to restore the real voting window.

## Defaults chosen where the request was silent

- **One shared password, not accounts.** Asked for "no auth". Left fully open,
  anyone finding `/admin` could delete talks and wipe every ballot, so the
  organiser routes sit behind one shared password. Voting routes are wide open,
  as intended.
- **Password in sessionStorage**, not localStorage: closing the tab forgets it.
- **No unique constraint on `voter_hash`.** Enforcing one would make a rejected
  insert reveal that the hash had voted before: an oracle for enumerating
  attendees. Duplicates are resolved by the tally instead.
- **The database is seeded with the conference row only.** No invented
  proposals: made-up speaker names on a real ballot would be worse than an
  empty one. `packages/db/demo-talks.sql` is separate and clearly marked.

## Explicitly NOT done

- The talks table is empty. Real CFP proposals need importing.
- The official ticket list has not been loaded, and will not be until tally time.
- Fonts and icons still come from Google Fonts and unpkg. On patchy conference
  wifi a third-party CDN can time out, and Phosphor sets `font-display: block`,
  so every icon stays invisible until ~150KB arrives. Self-hosting them, or
  inlining the nineteen icons actually used as SVG, is worth doing before the
  event. Deliberately left alone here to keep this change to the backend.
- Nothing is scheduled to open or close voting automatically. The dates in the
  conference row do it; no cron is involved.

## Next steps, in priority order

1. Import the real proposals once the CFP closes (Sat 26 Sep, 4pm IST), before
   voting opens at 5pm. `/admin/talks` takes a CSV and reads the FOSS United
   export's own column names (`session_title`, `speaker`, `track`, `link`)
   without editing. The same page exports the list back out in the columns it
   imports, so proposals can be fixed in a spreadsheet and reloaded.

   Note: a CSV with no `duration_minutes` column imports every talk as 0
   minutes. Harmless for voters - the public ballot never shows a duration -
   but the organiser list will read "0 min" until it is set.
2. Set `votes_per_voter` to something the talk count allows (see the trap above).
3. Do a dry run with James (the independent checker): hand over
   `/api/admin/results/ballots.csv` plus the ticket list, and confirm his
   independent count matches.
4. Finish the frontend copy items listed above.
5. Consider rate limiting if the vote is publicised widely.

## Verifying a change did not break anything

```bash
npm test          # 88 tests: 18 web, 37 db, 42 api (the api ones hit a real D1)
npm run typecheck
npm run build
```

Local end-to-end against a real Worker and a real database:

```bash
npm run db:migrate:local
npm run db:seed:local
npx wrangler d1 execute community-con --local --file packages/db/demo-talks.sql
echo "ADMIN_PASSWORD=local-test-password" > .dev.vars
npm run dev:api          # :8787
npm run dev              # :5173, proxies /api to :8787
```

Deploy with `npm run deploy`. It builds the site and pushes the Worker together;
they are one deployment and cannot be out of step.

## What was verified, and how

27 checks were run against the live deployment on 2026-09-23, and all passed.
They covered: a ballot accepted with no credentials; an invented ticket getting
a byte-identical response to a real one; superseded ballots dropped; the ticket
list changing the count; results refusing to publish while voting is open; the
export carrying every ballot and containing no email addresses; and the
organiser door rejecting both a missing and a wrong password.

The test data written during that run was deleted afterwards. The production
database was confirmed empty: 0 ballots, 0 talks, 0 voter-list rows, 0 audit
rows, status back to `scheduled`, results unpublished.
