import { Hono } from 'hono'
import { getConference, getTalksByConference, tallyConference, voteStats } from '../db/queries.js'
import { serializePublicTalk } from '../lib/talk-response.js'
import type { App } from '../index.js'
import { getVotingStatus, rankTalks } from '@cc/db'

/**
 * Everything a voter's browser touches. No password, no account, no cookie.
 */

const publicRoutes = new Hono<App>()

export const METHOD_NOTES =
  'Approval voting. Each ticket may select up to the vote budget; unused votes are allowed. ' +
  'Ballots are accepted without checking the ticket, and only the latest ballot from each ' +
  'valid ticket is counted at tally time. Ties share a vote total and are resolved by ' +
  'organiser scheduling judgment.'

publicRoutes.get('/conference', async c => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  return c.json({
    id: conf.id,
    name: conf.name,
    description: conf.description,
    voting_opens_at: conf.voting_opens_at,
    voting_closes_at: conf.voting_closes_at,
    voting_status: getVotingStatus(conf),
    votes_per_voter: conf.votes_per_voter,
    results_public: conf.results_public === 1,
    speaker_visibility: conf.speaker_visibility,
    // The countdown runs off this, not off the visitor's clock, which may be
    // minutes out and would otherwise close voting early for them.
    server_now: Date.now(),
  })
})

publicRoutes.get('/talks/archive', async c => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  const { results } = await getTalksByConference(c.env.DB, conf.id)

  // Scrambled per request, so no talk is disadvantaged by a fixed position on
  // a long ballot.
  const shuffled = [...results]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return c.json(shuffled.map(talk => serializePublicTalk(talk, conf.speaker_visibility)))
})

publicRoutes.get('/results', async c => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  if (conf.results_public !== 1) return c.json({ error: 'Results are not public yet' }, 403)

  const result = await tallyConference(c.env.DB, conf.id)
  return c.json({
    conference: { name: conf.name, description: conf.description },
    talks: rankTalks(result.talks).map(talk => serializePublicTalk(talk, conf.speaker_visibility)),
    stats: voteStats(result),
    method: { type: 'approval', votes_per_voter: conf.votes_per_voter, notes: METHOD_NOTES },
  })
})

/** A ballot is 64 hex characters of SHA-256 and nothing else. */
const VOTER_HASH = /^[0-9a-f]{64}$/

/**
 * Cast a ballot.
 *
 * The rules here are unusual on purpose, and every one of them is load-bearing:
 *
 *   Accept blindly. The server cannot tell a real (ticket, email) pair from an
 *   invented one - it never sees either, only their hash. It must not try. Any
 *   response that differed between a real pair and a made-up one would turn
 *   this endpoint into a way to enumerate who is attending.
 *
 *   Append, never update. A voter changing their mind writes a new row with its
 *   own cast_at. Nothing is overwritten and nothing is deleted, so the ballot
 *   table is a complete record of what was submitted, and when.
 *
 *   Decide nothing. Whether a ballot counts is settled at tally time against
 *   the official list of claimed tickets. See @cc/db `tallyBallots`.
 */
publicRoutes.post('/ballots', async c => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  // A brake on flooding, checked before anything is read or written.
  //
  // Keyed on the caller's IP, which is never stored - it goes to the binding
  // and nowhere else. Nothing here can be keyed on the voter: a per-voter limit
  // would have to recognise a repeat hash, and admitting that it recognised one
  // is precisely the signal this design refuses to give.
  //
  // Fails OPEN. If the binding is missing or throws, a real voter must still be
  // able to vote; losing ballots is far worse than admitting some spam.
  if (c.env.BALLOT_LIMIT) {
    try {
      const key = c.req.header('CF-Connecting-IP') ?? 'unknown'
      const { success } = await c.env.BALLOT_LIMIT.limit({ key })
      if (!success) {
        return c.json({ error: 'That was a lot of ballots at once. Try again in a minute.' }, 429)
      }
    } catch (error) {
      console.error('[community-con] rate limiter unavailable', error)
    }
  }

  let payload: { voter_hash?: unknown; talk_ids?: unknown }
  try {
    payload = await c.req.json()
  } catch {
    return c.json({ error: 'A ticket and email are required.' }, 422)
  }

  const voterHash = typeof payload.voter_hash === 'string' ? payload.voter_hash.trim().toLowerCase() : ''
  // Shape only. This says the browser hashed something, not that the something
  // exists - and it must never say more than that.
  if (!VOTER_HASH.test(voterHash)) {
    return c.json({ error: 'A ticket and email are required.' }, 422)
  }

  if (getVotingStatus(conf) !== 'open') return c.json({ error: 'Voting is closed.' }, 409)

  const submitted = Array.isArray(payload.talk_ids)
    ? payload.talk_ids.filter((id): id is string => typeof id === 'string')
    : []
  if (submitted.length > conf.votes_per_voter) {
    return c.json({ error: `You can select at most ${conf.votes_per_voter} talks.` }, 422)
  }

  const { results: eligible } = await c.env.DB.prepare(
    'SELECT id FROM talks WHERE conference_id = ? AND withdrawn_at IS NULL'
  ).bind(conf.id).all<{ id: string }>()
  const known = new Set(eligible.map(talk => talk.id))
  const accepted = [...new Set(submitted)].filter(id => known.has(id))

  await c.env.DB.prepare(`
    INSERT INTO ballots (id, conference_id, voter_hash, talk_ids, cast_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), conf.id, voterHash, JSON.stringify(accepted), Date.now()).run()

  return c.json({ ok: true, accepted: accepted.length }, 201)
})

export default publicRoutes
