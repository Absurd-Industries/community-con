# Communi-Con Voting System

The voting system for **Communi-Con at IndiaFOSS 2026**: ticket holders pick the community
talks, and the seven with the most votes go on stage in Hall 1.

It is run by **Absurd**, an independent community, and is not an official FOSS United
property. Communi-Con itself is organised by FOSS United. The site must never present itself
as the official event page; it says so in its header ("Voting System"), its footer, and its
share card. Event details and proposals come from
[FOSS United's Communi-Con page](https://fossunited.org/c/indiafoss/2026communi-con), shared
there under CC BY-SA (the page states no version, so neither do we).

Source: <https://github.com/Absurd-Industries/voting-system>

| | |
| --- | --- |
| Event | [Communi-Con @ IndiaFOSS 2026](https://fossunited.org/c/indiafoss/2026communi-con) |
| Where | Hall 1, NIMHANS Convention Centre, Bengaluru |
| Slots | 7 talks × 10 minutes, no Q&A |
| Proposals close | Sat 26 Sep 2026, 4:00 pm IST |
| Voting | Sat 26 Sep, 5:00 pm → Sun 27 Sep, 12:00 pm IST |
| Results | Sun 27 Sep, 2:00 pm IST |
| On stage | Sun 27 Sep, 3:30–4:45 pm IST |
| CFP | [Submit](https://fossunited.org/dashboard/cfp/apply/indiafoss/2026communi-con) · [All proposals](https://fossunited.org/dashboard/cfp/all/indiafoss/2026communi-con) |

Every fact above lives in `apps/web/src/lib/event.ts`. Copy, seed data, meta tags and the
social card all read from it, so that's the one file to edit when the schedule moves.

```bash
npm install
npm run dev          # http://localhost:5173
```

That's the whole setup. No keys, no `.env`, no second process.

> **This is a design preview.** It runs entirely in the browser, out of `localStorage`.
> Everything the backend needs to build is marked below.

---

## Who a voter is

Ticket IDs are six characters, and they arrive in each attendee's **ticket email** (not on the
badge). A ticket ID alone identifies nobody. A ticket has to be *claimed*, and claiming pairs it
with an email address; one address can't hold several tickets. So the pair is the identity,
and the pair is what gets hashed.

```
voter_hash = SHA256_hex( upper(trim(ticket)) + "+" + lower(trim(email)) )

  ("  k7m2p9 ", "Ashwin@Example.COM ")  →  "K7M2P9+ashwin@example.com"
```

Both sides must produce identical bytes. `voterIdHash` in `apps/web/src/lib/hash.ts` is the
normative implementation, and `mock/store.test.ts` pins it against the literal string, so
drift fails CI instead of silently orphaning every ballot.

Two details that matter:

- **Normalisation.** Someone who types `Ashwin@Gmail.com` on Saturday and
  `ashwin@gmail.com` on Sunday has to come out as one voter. Otherwise their first ballot
  is never superseded and both get counted. The seed data contains that exact case so the
  tally page demonstrates the collapse rather than asserting it.
- **Typos fail silently, by design.** A mistyped ticket or email hashes to a voter nobody holds,
  so the ballot is accepted and then dropped at tally time. The page can't warn about it
  without becoming a way to test whether a ticket exists, so the gate shows a prominent
  "double-check both" callout instead. Leading/trailing spaces and letter case are already
  forgiven by the normalisation above; the callout covers what isn't.
- **The literal `"+"`.** Without it, `("k7m2p", "9a@x.com")` and `("k7m2p9", "a@x.com")`
  hash to the same voter.

---

## The voting model

1. **Accept everything.** Any ticket, any email, straight through. The page never says
   whether a pair is valid, because then anyone could sit outside and enumerate.
2. **Append only.** Voting again writes a new row with its own `cast_at`. Nothing is
   updated or deleted, so the log of what arrived when is the audit trail.
3. **Decide later.** At tally time, hash the official list of claimed tickets the same way,
   drop ballots whose hash isn't on it, keep the newest ballot per remaining voter.
4. **Store nothing identifying.** The ticket and email live in the tab just long enough to
   be hashed. A leaked ballot store is a list of opaque hashes.

Rule 3 is implemented once, in `tally()` in `apps/web/src/mock/store.ts`, and shared by the
results and the tally page so they can't drift. Watch it at `/admin/tally`.

**Ties can overflow the slots.** Seven slots plus a three-way tie at rank 6 puts eight
talks at "rank ≤ 7". So a talk is marked *Selected* only when everyone ahead of it plus its
whole tie group still fits; a tie across the cutoff shows as undecided, pending an
organiser tie-break. Announcing eight winners for seven slots is a promise the schedule
can't keep.

Voting for your own talk is fine. One vote among hundreds doesn't move the needle, and
preventing it would mean linking proposals to tickets.

---

## Walking through it

The **Demo** panel, bottom-left, is not part of the product. It exists so you can show this
to someone without editing timestamps by hand.

| Control | What it does |
| --- | --- |
| Pretend voting is: before / open / closed | Moves a fictional window around "now" |
| Real IF26 schedule | Restores the published timestamps |
| Results published | Toggles `/results` |
| Organiser view | Reveals the `/admin/*` screens |
| Reset data | Wipes `localStorage` and reseeds |

1. **`/`** for the timeline and the CFP links. The countdown runs against the real
   26 September deadline.
2. Demo → **open** → **`/vote`**. Try a real-looking pair, then a garbage one: identical
   behaviour, which is the point. Pick some talks, submit, then sign in again with the
   **same email in different case** and submit again.
3. **Organiser view → `/admin/tally`** → **Load sample list** → **Run tally**. 42 submitted
   becomes 30 counted: 4 from pairs not on the list, 8 superseded, including that
   case-variant resubmission.
4. **`/admin/results`** for ranked totals, tie-breaks and CSV export.
5. Demo → close voting, publish results → **`/results`**.

---

## For the backend team

```
POST /api/ballots
{ voter_hash: string, talk_ids: string[] }
```

Five seams, roughly in order of how much thought they need:

1. **`lib/hash.ts`** is the contract. Reproduce `voterIdHash` byte-for-byte; everything
   else depends on it agreeing.
2. **`lib/ballot.ts`** documents the endpoint. The response must be identical for a real
   pair and an invented one: same status, same body, same timing. Append only, and stamp
   every row with its own `cast_at`.
3. **`lib/api.ts`** is the only thing that knows where data comes from. It keeps the exact
   signature of the networked version it replaced, so restoring `fetch` here brings the app
   back onto a real API with no page or component changes. The original body is in a
   comment at the top.
4. **The tally.** `tally()` in `mock/store.ts` is the reference, about 20 lines. The
   official list arrives as `ticket_id,email` per line; `lib/voter-list.ts` parses it and
   is covered by tests.
5. **Auth.** There is none. `lib/admin.ts` is a `localStorage` flag that reveals the
   organiser screens and is not pretending to be access control. `apps/api` still has the
   full Clerk integration if that's the direction.

`apps/web/src/mock/` is delete-on-sight once the API is live. Nothing imports from it
except `lib/api.ts`, `lib/ballot.ts`, the demo bar and the tally page.

```
apps/web/          The preview. React + Vite + Tailwind.
  src/mock/        The entire "backend"
  src/lib/         event, hash, ticket, ballot, api, voter-list, track-colors,
                   admin, time, talk-order
  src/pages/       LandingPage, VotePage, PublicResultsPage, admin/*
apps/api/          Cloudflare Worker (Hono + D1 + Clerk). Not used by the preview.
packages/db/       Shared types, voting rules, CSV parser, schema.sql
```

`apps/api` is the previous production implementation, carried over intact. It still
compiles and its tests pass (`npm run test:api`), but it predates the ticket+email
identity, so its ballot handling is the part that needs rewriting.

---

## Design

Track colours come from the IndiaFOSS 2026 speaker poster generator
(`MAIN_TRACK_COLORS` in its `script.js`); the wordmark and maze motif are extracted from
the same source.

The set is deliberately nine colours, not one. IndiaFOSS gives each track its own accent,
which is the festival saying it's a community of communities, so the ballot shows every
proposal in its track's colour. `lib/track-colors.ts` maps track names to accents with a
stable hash, so a new track from the CFP still gets a consistent colour.

**Interaction is green (`#08B54D`)** and sits outside those nine, so a button never reads
as a track. Buttons are white on green. Note that white on `#08B54D` is 2.72:1, under the
4.5:1 WCAG AA wants for label-sized text; hover deepens to `#06883A`, which clears it at
4.57:1. Making the rest state clear it too is a one-line swap in `.btn-primary`.

Each track accent has two values. `track-*` is the festival's vivid original, for rings and
rules that carry no text. `trackInk-*` is the same hue darkened until it clears WCAG AA on
white *and* on its own 12% tint, for anywhere the colour has to be read. White on
`#F5AB00` is 1.96:1, and nobody in row 30 is reading that.

Assets live in `apps/web/public/images/`. The maze is a 53 KB alpha mask that `.maze` in
`index.css` tints with `currentColor`. Don't ship the source PNGs: they're 1080×1080 poster
artwork at 3 MB each, and that's worse than no background on conference wifi.

The 14 proposals, speakers, tickets and emails in `mock/seed.ts` are invented. Swap in a
real CFP export when there is one.

---

## Commands

```bash
npm run dev          # preview at :5173
npm run build        # static bundle in apps/web/dist
npm run preview      # serve the built bundle
npm test             # web + shared package tests
npm run typecheck    # web + api

npm run dev:api      # backend, not needed for the preview
npm run test:api
npm run db:reset-seed:local

node apps/web/scripts/og/render-og.mjs   # regenerate the social card, needs Chrome
```

## Deployment

The preview is a static bundle, so it deploys as an assets-only Worker with no server code,
bindings or secrets.

```bash
npm run deploy        # build + wrangler deploy, using ./wrangler.jsonc
```

Cloudflare's Git integration runs the same two commands on every push to `main`. The root
`wrangler.jsonc` exists so `wrangler deploy` works from the repo root: without it, wrangler
finds `apps/api/wrangler.toml` inside a workspace and refuses to guess which project is
meant. It sets `not_found_handling: "single-page-application"` so `/vote`, `/results` and
`/admin/*` resolve to `index.html` instead of 404.

There is deliberately no `public/_redirects`. Workers Assets rejects the usual
`/* /index.html 200` rule as an infinite loop, and `not_found_handling` already covers it.
Hosting `dist` elsewhere means adding that host's own SPA fallback.

GitHub Actions runs tests, type-checks and the build. It deliberately does not deploy,
because Cloudflare already does and two pipelines shipping the same commit is how you get a
confusing rollback.

## Still open

- **Domain.** `community-con.pages.dev` in `index.html`'s `og:url` / `og:image` and in
  `apps/api/wrangler.toml` is a placeholder.
- **Offline.** Inter and the Phosphor icons still come from Google Fonts and unpkg. With no
  connection the page works, in system-ui and without icons. Self-host both before the day;
  this runs on conference wifi.
- **`apps/api/wrangler.toml`** needs a real `database_id` (`wrangler d1 create community-con`).
