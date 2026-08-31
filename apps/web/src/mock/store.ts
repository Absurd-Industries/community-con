import type { AuditLog, Conference, Talk } from '@cc/db'
import { sha256Hex } from '../lib/hash.js'
import {
  DEMO_CAST_TICKETS,
  DEMO_VALID_TICKETS,
  SLOT_COUNT,
  seedConference,
  seedTalks,
} from './seed.js'

/**
 * The demo's entire "backend": one JSON blob in localStorage.
 *
 * The shape mirrors the real D1 schema (packages/db/schema.sql) with one
 * deliberate difference - votes are stored as append-only BALLOTS keyed by a
 * hashed ticket, not as individual (voter, talk) rows. That is the model Shree
 * described: accept everything, decide what counts at tally time. Keeping it
 * here means the preview is not lying about the data model.
 */

const STORAGE_KEY = 'community-con:v1'

export interface Ballot {
  id: string
  ticket_hash: string
  talk_ids: string[]
  cast_at: number
}

export interface TieBreak {
  id: string
  conference_id: string
  selected_talk_id: string
  tied_talk_ids: string[]
  reason: string
  admin_email: string
  created_at: number
}

export interface DemoStore {
  conference: Conference
  talks: Talk[]
  /** Append-only. A voter re-submitting adds a row; it never edits one. */
  ballots: Ballot[]
  /** Hashed. Empty means "no official list uploaded yet" - see effectiveBallots. */
  valid_ticket_hashes: string[]
  audit_logs: AuditLog[]
  tie_breaks: TieBreak[]
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/** mulberry32. Seeded so the demo shows the same numbers on every machine. */
function makeRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function buildSeedBallots(talks: Talk[], now: number): Promise<Ballot[]> {
  const rng = makeRng(20260926)
  const ballots: Ballot[] = []

  // A popularity curve, so the ranked results have a shape instead of noise.
  // Index 0 is the most-picked talk; the tail still gets votes.
  const weights = talks.map((_, i) => 1 / (1 + i * 0.42))

  const pickTalks = (budget: number): string[] => {
    const chosen = new Set<string>()
    let guard = 0
    while (chosen.size < budget && guard++ < 200) {
      const roll = rng() * weights.reduce((a, b) => a + b, 0)
      let acc = 0
      for (let i = 0; i < talks.length; i++) {
        acc += weights[i]
        if (roll <= acc) {
          chosen.add(talks[i].id)
          break
        }
      }
    }
    return [...chosen]
  }

  for (const [index, ticket] of DEMO_CAST_TICKETS.entries()) {
    const hash = await sha256Hex(ticket)
    // Most voters use their whole budget; some use less. Both are allowed.
    const budget = rng() < 0.7 ? SLOT_COUNT : 2 + Math.floor(rng() * 3)
    ballots.push({
      id: `ballot_seed_${index}`,
      ticket_hash: hash,
      talk_ids: pickTalks(Math.min(budget, talks.length)),
      cast_at: now - (110 - index * 3) * 60 * 1000,
    })

    // Every fifth voter changed their mind. The superseded ballot stays in the
    // log - the tally is what drops it.
    if (index % 5 === 4) {
      ballots.push({
        id: `ballot_seed_${index}_revised`,
        ticket_hash: hash,
        talk_ids: pickTalks(Math.min(SLOT_COUNT, talks.length)),
        cast_at: now - (40 - index) * 60 * 1000,
      })
    }
  }

  return ballots.sort((a, b) => a.cast_at - b.cast_at)
}

async function buildSeedStore(): Promise<DemoStore> {
  const now = Date.now()
  const talks = seedTalks(now)
  return {
    conference: seedConference(now),
    talks,
    ballots: await buildSeedBallots(talks, now),
    // Left empty on purpose. Results count every ballot until an organiser
    // uploads the official list on the Tally page - which is the moment the
    // demo is meant to make visible.
    valid_ticket_hashes: [],
    audit_logs: [],
    tie_breaks: [],
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

let storePromise: Promise<DemoStore> | null = null

function read(): DemoStore | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoStore
    // Cheap shape check: a partially-written or stale blob is not worth
    // debugging in front of an audience, so throw it away and reseed.
    if (!parsed?.conference?.id || !Array.isArray(parsed.talks)) return null
    return parsed
  } catch {
    return null
  }
}

function write(store: DemoStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (error) {
    // Private mode, quota, or a disabled storage API. The demo still works for
    // this tab; it just will not survive a reload.
    console.warn('[community-con] could not persist demo data', error)
  }
}

export function getStore(): Promise<DemoStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const existing = read()
      if (existing) return existing
      const seeded = await buildSeedStore()
      write(seeded)
      return seeded
    })()
  }
  return storePromise
}

/** Apply a change and persist it. Every mutating handler goes through here. */
export async function mutate<T>(fn: (store: DemoStore) => T): Promise<T> {
  const store = await getStore()
  const result = fn(store)
  write(store)
  return result
}

/** Wipe and reseed. Backs the DemoBar's reset button. */
export async function resetDemo(): Promise<void> {
  window.localStorage.removeItem(STORAGE_KEY)
  storePromise = buildSeedStore().then(seeded => {
    write(seeded)
    return seeded
  })
  await storePromise
}

export async function loadOfficialTicketList(): Promise<number> {
  const hashes = await Promise.all(DEMO_VALID_TICKETS.map(sha256Hex))
  return mutate(store => {
    store.valid_ticket_hashes = hashes
    return hashes.length
  })
}

// ---------------------------------------------------------------------------
// The tally rule
// ---------------------------------------------------------------------------

export interface TallySummary {
  ballots_cast: number
  from_unknown_tickets: number
  superseded: number
  counted: number
  /** Null until an official ticket list has been loaded. */
  eligible_tickets: number | null
}

/**
 * The whole voting model in one function.
 *
 * Ballots are accepted without validation, so tallying means: drop ballots from
 * tickets that are not on the official list, then keep only the latest ballot
 * per remaining ticket. With no list loaded, every ticket is treated as valid -
 * that is what the live results show while voting is still running.
 */
export function tally(store: DemoStore): { ballots: Ballot[]; summary: TallySummary } {
  const valid = new Set(store.valid_ticket_hashes)
  const hasList = valid.size > 0

  const known = hasList
    ? store.ballots.filter(b => valid.has(b.ticket_hash))
    : store.ballots

  const latestByTicket = new Map<string, Ballot>()
  for (const ballot of known) {
    const current = latestByTicket.get(ballot.ticket_hash)
    if (!current || ballot.cast_at > current.cast_at) latestByTicket.set(ballot.ticket_hash, ballot)
  }

  const counted = [...latestByTicket.values()]
  return {
    ballots: counted,
    summary: {
      ballots_cast: store.ballots.length,
      from_unknown_tickets: store.ballots.length - known.length,
      superseded: known.length - counted.length,
      counted: counted.length,
      eligible_tickets: hasList ? valid.size : null,
    },
  }
}

/** Vote count per talk id, derived from the counted ballots. */
export function voteCounts(store: DemoStore): Map<string, number> {
  const counts = new Map<string, number>()
  for (const talk of store.talks) counts.set(talk.id, 0)
  for (const ballot of tally(store).ballots) {
    for (const talkId of ballot.talk_ids) {
      if (counts.has(talkId)) counts.set(talkId, (counts.get(talkId) ?? 0) + 1)
    }
  }
  return counts
}
