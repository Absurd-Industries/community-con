# Communi-Con Voting System

Vote for the Communi-Con talks at **IndiaFOSS 2026**. Ticket holders pick the community talks,
and the 7 with the most votes go on stage in Hall 1, 10 minutes each.

This voting system is run by [**Absurd Industries**](https://absurd.industries/), an
independent community. Communi-Con itself is organised by FOSS United; see the
[official event page](https://fossunited.org/c/indiafoss/2026communi-con) for everything about
the event.

## Your privacy

- Your ticket ID and email are hashed together **in your browser**. Only that anonymous hash is
  ever sent, so we never see who you are and have no personal data to share.
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
npm run dev          # http://localhost:5173
```

No keys, no `.env`, no second process. This is a design preview: everything runs in the
browser out of `localStorage`, and a **Demo** panel (bottom left) lets you move the voting
window, publish results and open the organiser screens.

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

**The ballot endpoint** the backend needs to provide:

```
POST /api/ballots
{ voter_hash: string, talk_ids: string[] }
```

Respond identically to real and invented pairs, append only.

**Where things live**

```
apps/web/src/lib/event.ts   Every event fact and link. Edit here when the schedule moves.
apps/web/src/lib/hash.ts    The voter hash.
apps/web/src/lib/api.ts     The only file that knows where data comes from. Swap in fetch here.
apps/web/src/mock/          The whole in-browser "backend". Delete once the API is live.
apps/web/src/mock/store.ts  tally(), the counting rule, shared by results and tally pages.
apps/api/                   An older Worker (Hono + D1 + Clerk), not used by the preview.
```

Please keep one thing true: this site must never look like the official FOSS United page. The
header says "Voting System" and the footer names who runs it.

## Commands

```bash
npm test             # tests
npm run typecheck
npm run build        # static bundle in apps/web/dist
npm run deploy       # build + wrangler deploy
node apps/web/scripts/og/render-og.mjs   # regenerate the share card (needs Chrome)
```

Deploys as a static, assets-only Cloudflare Worker via `./wrangler.jsonc`. Pushing to `main`
deploys automatically.

## Still to do

- Replace the placeholder domain in `index.html`'s share tags.
- Self-host Inter and the Phosphor icons so the page works on patchy conference wifi.
- The sample proposals, tickets and emails in `mock/seed.ts` are invented; swap in the real
  CFP export when it's ready.
