import { Hono } from 'hono'
import { getConference } from '../../db/queries.js'
import { logAdminAction } from '../../lib/audit.js'
import type { App } from '../../index.js'
import {
  countVotes,
  parseBallotRow,
  placings,
  rankTalks,
  tallyBallots,
  type BallotRow,
  type Talk,
} from '@cc/db'

/**
 * The official list of claimed tickets, and the tally run against it.
 *
 * The organiser pastes `ticket_id,email` lines into their browser, and the
 * browser hashes each pair before anything is sent - the same way the vote page
 * does. What arrives here is a list of 64-character hashes. The tickets and
 * email addresses stay on the organiser's machine, which is the point: a
 * database that never holds them cannot leak them.
 */

const adminVoters = new Hono<App>()
const VOTER_HASH = /^[0-9a-f]{64}$/

function readHashes(body: { voter_hashes?: unknown }): { hashes: string[]; malformed: number } {
  const raw = Array.isArray(body.voter_hashes) ? body.voter_hashes : []
  const clean = new Set<string>()
  let malformed = 0
  for (const value of raw) {
    const hash = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (VOTER_HASH.test(hash)) clean.add(hash)
    else malformed++
  }
  return { hashes: [...clean], malformed }
}

/** How many claimed tickets are currently loaded, if any. */
adminVoters.get('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  const row = await c.env.DB.prepare(
    'SELECT COUNT(*) as count, MAX(uploaded_at) as uploaded_at FROM valid_voters WHERE conference_id = ?'
  ).bind(conf.id).first<{ count: number; uploaded_at: number | null }>()
  return c.json({ count: row?.count ?? 0, uploaded_at: row?.uploaded_at ?? null })
})

/**
 * Run the tally against a list without saving it.
 *
 * An organiser should be able to see what a ticket list does to the numbers
 * before committing to it. Nothing here writes.
 */
adminVoters.post('/preview', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const { hashes, malformed } = readHashes(await c.req.json())

  const [talkRows, ballotRows] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM talks WHERE conference_id = ? AND withdrawn_at IS NULL')
      .bind(conf.id).all<Talk>(),
    c.env.DB.prepare('SELECT * FROM ballots WHERE conference_id = ? ORDER BY cast_at ASC, rowid ASC')
      .bind(conf.id).all<BallotRow>(),
  ])

  const ballots = ballotRows.results.map(parseBallotRow)
  const { ballots: counted, summary } = tallyBallots(ballots, hashes)
  const talks = talkRows.results
  const counts = countVotes(counted, talks.map(talk => talk.id))

  const sorted = talks
    .map(talk => ({
      id: talk.id,
      title: talk.title,
      presenter_name: talk.presenter_name,
      vote_count: counts.get(talk.id) ?? 0,
    }))
    .sort((a, b) => b.vote_count - a.vote_count || a.title.localeCompare(b.title))

  const slots = conf.votes_per_voter
  const placing = placings(sorted, slots)

  return c.json({
    summary,
    malformed,
    slots,
    rows: rankTalks(sorted).map((talk, index) => ({ ...talk, placing: placing[index] })),
    latest_ballot_at: ballots.reduce((latest, b) => Math.max(latest, b.cast_at), 0) || null,
  })
})

/** Commit a ticket list. Replaces whatever was there; the live results use it. */
adminVoters.put('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const { hashes } = readHashes(await c.req.json())
  if (hashes.length === 0) {
    return c.json({ error: 'That list had no usable ticket hashes in it.' }, 422)
  }

  const now = Date.now()
  // Replace rather than merge. A second upload is a corrected list, not an
  // addition to the first, and quietly keeping stale hashes would enfranchise
  // tickets the organiser just removed.
  const statements = [
    c.env.DB.prepare('DELETE FROM valid_voters WHERE conference_id = ?').bind(conf.id),
    ...hashes.map(hash =>
      c.env.DB.prepare(
        'INSERT INTO valid_voters (conference_id, voter_hash, uploaded_at) VALUES (?, ?, ?)'
      ).bind(conf.id, hash, now)
    ),
  ]
  // D1 caps how much one batch may carry, so send it in chunks.
  const CHUNK = 500
  for (let i = 0; i < statements.length; i += CHUNK) {
    await c.env.DB.batch(statements.slice(i, i + CHUNK))
  }

  await logAdminAction(c.env.DB, c.get('adminLabel'), 'load_ticket_list', 'voters', conf.id, {
    tickets: hashes.length,
  })
  return c.json({ ok: true, count: hashes.length })
})

/** Go back to counting every ballot. */
adminVoters.delete('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  await c.env.DB.prepare('DELETE FROM valid_voters WHERE conference_id = ?').bind(conf.id).run()
  await logAdminAction(c.env.DB, c.get('adminLabel'), 'clear_ticket_list', 'voters', conf.id, {})
  return c.json({ ok: true })
})

export default adminVoters
