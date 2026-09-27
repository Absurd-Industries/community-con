# Communi-Con Voting System

**Live at <https://communicon.absurd.industries>**

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

## For organisers

Everything happens at **<https://communicon.absurd.industries/admin>**. Unlock it with the
shared organiser password (ask whoever runs the vote).

### 1. Upload the talks (Sat 4:00 to 5:00 pm)

Proposals close at 4:00 pm. Voting opens at 5:00 pm, and **the ballot locks itself at that
moment**: after that, talks can only be withdrawn, never added or edited.

1. Open **`/admin/talks`**.
2. In the **CSV** box, choose the file. The FOSS United submissions export works as-is
   (`session_title`, `speaker`, `track`, `link`). So does our own format: `title`,
   `description`, `duration_minutes`, `presenter_name`, `presenter_bio`, `presenter_email`,
   `talk_type`, `cfp_url`, `cfp_content`. Only `title` and `presenter_name` are required.
3. Check the count. There are 7 slots, so with 7 or fewer talks everyone gets on stage and
   the vote decides nothing.

**Importing adds to the list; it doesn't replace it.** Uploading the same file twice gives
you every talk twice. To fix mistakes, delete the wrong talks first, or **Export** the list,
fix it in a spreadsheet, delete everything and import once. All of this has to happen before
5:00 pm.

**Running late?** On `/admin/conference`, under **Override Status**, choose **CLOSED** and click
**Save Voting Settings**. That keeps the ballot unlocked. Upload the talks, then switch back to
**SCHEDULED** and save. Voting opens late instead of opening empty.

### 2. While voting is open

Nothing to do. Every submission is kept, and a voter's latest ballot replaces their earlier
ones at count time.

### 3. Count and download (Sun, after 12:00 pm)

1. **Verify:** on **`/admin/tally`**, paste the official list of claimed tickets, one
   `ticket_id,email` per line, then click **Run tally**, then **Commit this ticket list**. The
   hashing happens in your browser; only hashes are sent. Until you commit a list, results
   count every ballot, including made-up ones.
2. **Break ties:** on **`/admin/results`**, a tie across the 7th slot is marked undecided.
   Record the tie-break there.
3. **Download the results:** **Export CSV** on `/admin/results` gives `results.csv` (title,
   presenter, votes).
4. **Publish (2:00 pm):** click **Publish Results** on `/admin/results` to open the public
   `/results` page. This is blocked while voting is still open.

### Files for an independent recount

| File | Where | What's in it |
| --- | --- | --- |
| `proposals-<date>.csv` | `/admin/talks` → **Export proposals** | Every talk, with the `id` that ballots refer to. Includes presenter emails, so keep it private. |
| `ballots.csv` | Command below, no button yet | Every ballot ever cast: `voter_hash`, `cast_at_iso`, `cast_at_ms`, `talk_ids`. No emails, no tickets. |

```bash
curl -H "X-Admin-Password: $ADMIN_PASSWORD" \
  https://communicon.absurd.industries/api/admin/results/ballots.csv -o ballots.csv
```

The recount rule is the one on the site: hash each `ticket_id,email` pair from the official
list as below, drop ballots whose hash isn't on it, and keep each hash's latest ballot.

### Warnings

- **Never run `npm run db:seed:remote` again.** It deletes every ballot.
- **Never set Override Status to OPEN to "test" it.** That locks the ballot, even an empty one.
- **Pushing to `main` redeploys the live site.** Avoid it while voting is open unless you mean it.

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
npm test             # 116 tests; the API ones run against a real D1
npm run typecheck
npm run build        # static bundle in apps/web/dist
npm run deploy       # build + wrangler deploy, site and API together
node apps/web/scripts/og/render-og.mjs   # regenerate the share card (needs Chrome)
```

One Cloudflare Worker serves the site and the API, configured in `./wrangler.jsonc`.
Pushing to `main` deploys automatically.

See [HANDOFF.md](HANDOFF.md) for the state of the build and the traps in it.

## Still to do

- Add a **Download ballots.csv** button to `/admin/results`, so the recount file doesn't need
  `curl`.
- Self-host Inter and the Phosphor icons so the page works on patchy conference wifi.
