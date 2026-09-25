# Communi-Con Voting System

Vote for the Communi-Con talks at **IndiaFOSS 2026**. Ticket holders pick the community talks,
and the 7 with the most votes go on stage in Hall 1, 10 minutes each.

This voting system is run by [**Absurd Industries**](https://absurd.industries/), an
independent community. Communi-Con itself is organised by FOSS United; see the
[official event page](https://fossunited.org/c/indiafoss/2026communi-con) for everything about
the event.

## Your privacy

- Your ticket ID and email are hashed together **in your browser**. Only that hash is ever
  sent, so we never see who you are.
- FOSS United holds the ticket list, so when they verify the count they can match a hash back
  to a ticket. Votes are only ever published as totals.
- The page can't tell you if your details are right, because checking would mean knowing who
  you are. Copy both exactly from your ticket email: a typo means your vote won't count.
- You can vote as often as you like. Only your latest ballot counts.

## Key times (IST)

| | |
| --- | --- |
| Proposals close | Sat 26 Sep, 4:00 pm |
| Voting | Sat 26 Sep, 5:00 pm to Sun 27 Sep, 12:00 pm |
| Results | Sun 27 Sep, 2:00 pm |
| On stage | Sun 27 Sep, 3:30 to 4:45 pm, Hall 1 |

Event details and talk proposals come from
[FOSS United's Communi-Con page](https://fossunited.org/c/indiafoss/2026communi-con), shared
under CC BY-SA.

---

## Run it locally

```bash
npm install
npm run db:migrate:local
npm run db:seed:local
echo "ADMIN_PASSWORD=local-test-password" > .dev.vars

npm run dev:api      # the Worker, on :8787
npm run dev          # the site, on :5173
```

Two processes: Vite serves the site and proxies `/api` to the Worker. In production a
single Worker does both, so there is one origin and no CORS.

The database starts with the conference and no proposals. For something to click on,
load `packages/db/demo-talks.sql` - invented talks, local database only.

## How voting works

1. **Accept every ballot.** Any ticket and email go straight through. Saying "invalid ticket"
   would let anyone guess tickets until one worked.
2. **Never overwrite.** Voting again adds a new, timestamped ballot.
3. **Count later.** At tally time, hash the official list of claimed tickets the same way, drop
   ballots that don't match, and keep each voter's latest.

A tie across the 7th slot shows as undecided until the organisers break it, rather than
announcing eight winners for seven slots.

## For contributors

**The voter hash** has to match byte for byte between browser and server:

```
voter_hash = SHA256_hex( upper(trim(ticket)) + "+" + lower(trim(email)) )

("  k7m2p9 ", "Ashwin@Example.COM ")  →  "K7M2P9+ashwin@example.com"
```

Trimming and case folding mean small differences between visits still count as one voter. The
`"+"` stops two different pairs from running together. `voterIdHash` in
`apps/web/src/lib/hash.ts` is the reference, and a test pins it.

**The ballot endpoint**:

```
POST /api/ballots
{ voter_hash: string, talk_ids: string[] }
```

It answers a real pair and an invented one identically - same status, same body - and
appends rather than updating. Anything else would turn it into a way to find out who
holds a ticket.

**Where things live**

```
apps/web/src/lib/event.ts      Every event fact and link. Edit here when the schedule moves.
apps/web/src/lib/hash.ts       The voter hash. hash.test.ts pins it.
apps/web/src/lib/api.ts        The only file that knows where data comes from.
packages/db/src/ballot.ts      tallyBallots(), the counting rule. Shared by Worker and browser.
packages/db/schema.sql         The database. No table of people, by design.
apps/api/src/routes/public.ts  Everything a voter touches. No password.
apps/api/src/routes/admin/     Everything behind the organiser password.
packages/db/src/csv.ts         CSV in and out. Reader and writer share a column list.
```

**Proposals go in and out as CSV** on `/admin/talks`. The importer also reads the
FOSS United submissions export as-is (`session_title`, `speaker`, `track`, `link`).
The export writes the columns the importer accepts, so a list can be exported,
edited in a spreadsheet and loaded back. Importing stops once voting opens and the
ballot locks; exporting keeps working.

**Organisers** share one password, set on the deployment as a Cloudflare secret:

```bash
npx wrangler secret put ADMIN_PASSWORD
```

There are no accounts. It is a lock on the screens that can delete talks and wipe
ballots, not a user system.

Please keep one thing true: this site must never look like the official FOSS United page. The
header says "Voting System" and the footer names who runs it.

## Commands

```bash
npm test             # 88 tests; the API ones run against a real D1
npm run typecheck
npm run build        # static bundle in apps/web/dist
npm run deploy       # build + wrangler deploy, site and API together
node apps/web/scripts/og/render-og.mjs   # regenerate the share card (needs Chrome)
```

One Cloudflare Worker serves the site and the API, configured in `./wrangler.jsonc`.
Pushing to `main` deploys automatically.

See [HANDOFF.md](HANDOFF.md) for the state of the build and the traps in it.

## Still to do

- Load the real CFP proposals. The database ships with none on purpose.
- Self-host Inter and the Phosphor icons so the page works on patchy conference wifi.
