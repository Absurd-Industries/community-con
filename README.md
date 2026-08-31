# Community Con — IndiaFOSS 2026

The flash lightning-talk hour, programmed by the people in the room. Proposals close at the
end of day one, ticket-holders vote until noon on day two, and the top talks take the stage
after lunch.

> **This repository is a design preview.** It runs entirely in your browser — no database,
> no accounts, no server. Everything you see is served from `localStorage`. The pieces that
> need a real backend are marked below and left for the backend team.

```bash
npm install
npm run dev          # http://localhost:5173
```

That's the whole setup. No keys, no `.env`, no second process.

---

## The voting model

The unusual part, and the reason this isn't just a form:

1. **Ballots are accepted without checking the ticket.** Type anything into the ticket
   field and it goes through. The page never says whether a ticket is valid — if it did,
   anyone could sit outside the venue and enumerate ticket IDs until one worked.
2. **Ballots are append-only.** Voting again writes a new row; nothing is updated or
   deleted. "The latest ballot wins" is a property of the tally, not of the write path.
3. **Validity is decided once, later, at tally time.** Take the official ticket list, drop
   ballots from tickets that aren't on it, keep only the most recent ballot from each
   remaining ticket, count what's left.
4. **Ticket IDs are hashed in the browser** (SHA-256, `src/lib/hash.ts`) before anything is
   stored. A leaked ballot store should not be a list of who attended.
5. **Talk order is randomised per visit**, with already-picked talks pinned on top so cards
   don't jump underneath you (`src/lib/talk-order.ts`).

Rule 3 is implemented once, in `tally()` in `apps/web/src/mock/store.ts`, and shared by the
live results and the tally page — so the two can't drift apart. Watch it work at
`/admin/tally`: paste the official list and the discard counts appear.

Voting for your own talk is allowed. With one vote among hundreds it doesn't move the
needle, and preventing it would mean linking proposals to tickets — which costs everyone
their anonymity for no real gain.

---

## Walking through the preview

There's a **Demo** panel in the bottom-left corner. It is not part of the product; it
exists so you can show this to someone without editing timestamps by hand.

| Control | What it does |
| --- | --- |
| Voting: before / open / closed | Moves the voting window around "now" |
| Results published | Toggles the public `/results` page |
| Organiser view | Reveals the four `/admin/*` screens |
| Reset data | Wipes `localStorage` and reseeds |

A suggested run-through:

1. **`/`** — what Community Con is, and the three-step timeline.
2. **`/vote`** — the ticket gate. Try a real-looking ID and then a garbage one; they behave
   identically, which is the point. Pick some talks, submit, submit again.
3. **Organiser view → `/admin/tally`** — hit **Load sample list**, then **Run tally**. The
   seeded data contains four ballots from tickets that aren't on the official list and six
   that were superseded, so 40 submitted becomes 30 counted.
4. **`/admin/results`** — ranked totals, ties, tie-break recording, CSV export.
5. **Demo panel → close voting, publish results → `/results`.**

---

## Layout

```
apps/web/          The preview. React + Vite + Tailwind.
  src/mock/        The entire "backend" — see below.
  src/lib/         api, ballot, ticket, hash, admin, time, talk-order
  src/pages/       LandingPage, VotePage, PublicResultsPage, admin/*
apps/api/          Cloudflare Worker (Hono + D1 + Clerk). NOT used by the preview.
packages/db/       Shared types, voting rules, CSV parser, schema.sql
```

`apps/api` is the previous production implementation, carried over intact as a starting
point. It still compiles and its tests still pass (`npm run test:api`), but nothing in the
preview calls it.

---

## Handing off to the backend team

Four seams, in order of how much thought they need.

**1. `apps/web/src/lib/api.ts`** — the only thing that knows where data comes from. It keeps
the exact signature of the networked version it replaced, so restoring `fetch` here brings
the whole app back onto a real API with no changes to any page or component. The original
body is in a comment at the top of the file.

**2. `apps/web/src/lib/ballot.ts`** — the ballot contract, written out in full:

```
POST /api/ballots
{ ticket_hash: string, talk_ids: string[] }
```

The response must be identical for a real ticket and a made-up one — same status, same
body, same timing. Anything else turns the vote page into a ticket oracle. Append-only.

**3. The tally** — `tally()` in `apps/web/src/mock/store.ts` is the reference
implementation, roughly 20 lines. The production version runs server-side against the
ballot table; the rule is the same.

**4. Auth** — there is none here. `src/lib/admin.ts` is a `localStorage` flag that reveals
the organiser screens; it is not access control and isn't pretending to be. `apps/api`
still has the full Clerk integration if that's the direction.

Also worth knowing:

- `apps/web/src/mock/` is delete-on-sight once the API is live. Nothing else imports from it
  except `lib/api.ts`, `lib/ballot.ts`, the demo bar and the tally page.
- `packages/db/src/csv.ts` is shared: the Worker's CSV import and the preview's both use it.
- `apps/api/wrangler.toml` needs a real `database_id` (`wrangler d1 create community-con`).

---

## Commands

```bash
npm run dev          # preview at :5173
npm run build        # static bundle in apps/web/dist
npm run preview      # serve the built bundle
npm test             # web + shared package tests
npm run typecheck    # web + api

# Backend. Not needed for the preview.
npm run dev:api
npm run test:api
npm run db:reset-seed:local
```

Deploying the preview is just `apps/web/dist` on any static host —
`public/_redirects` already handles SPA fallback. The GitHub Actions workflow deploys it to
Cloudflare Pages and needs only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Regenerate the social card after editing `apps/web/scripts/og/og-image.html`:

```bash
node apps/web/scripts/og/render-og.mjs      # needs a local Chrome
```

---

## Still placeholder

- **Logo and favicon** — `apps/web/public/images/favicon.svg` is a stand-in mark. Swap it
  and the wordmark in `App.tsx` when FOSS United supplies artwork.
- **Accent colour** — the palette is monochrome with black as the interaction colour, to
  match fossunited.org. One token in `apps/web/tailwind.config.js` if that changes.
- **Seed content** — the 14 proposals, speakers and ticket IDs in
  `apps/web/src/mock/seed.ts` are invented. Replace with a real CSV export when there is one.
- **Domain** — `community-con.pages.dev` in `index.html` meta and `wrangler.toml`.
- **Offline** — no data is fetched, but Inter and the Phosphor icons still come from Google
  Fonts and unpkg. With no connection the page works, in system-ui and without icons. Self-host
  both in `apps/web/public/` if the preview has to run on conference wifi.
