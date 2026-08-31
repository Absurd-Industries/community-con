import { Hono } from 'hono'
import { getConference, getTalksByConference } from '../db/queries.js'
import { getVotingStatus } from '@cc/db'
import type { Bindings, Variables } from '../index.js'
import { requireAuth } from '../middleware/auth.js'
import { serializePublicTalk } from '../lib/talk-response.js'

const conference = new Hono<{ Bindings: Bindings; Variables: Variables }>()

conference.get('/conference', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured yet' }, 404)

  const status = getVotingStatus(conf)
  const now = Date.now()
  return c.json({
    id: conf.id,
    name: conf.name,
    description: conf.description,
    voting_opens_at: conf.voting_opens_at,
    voting_closes_at: conf.voting_closes_at,
    voting_status: status,
    votes_per_voter: conf.votes_per_voter,
    results_public: conf.results_public === 1,
    speaker_visibility: conf.speaker_visibility,
    server_now: now,
  })
})

// Public archive of submitted talks - powers the landing page for anonymous
// visitors. No auth, no vote counts, and presenter_email stays private.
conference.get('/talks/archive', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured yet' }, 404)

  const { results: talks } = await getTalksByConference(c.env.DB, conf.id)
  // Scramble per request so no talk is disadvantaged by a fixed order -
  // everyone browsing the archive gives every talk equal visibility.
  const archive = [...talks]
  for (let i = archive.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[archive[i], archive[j]] = [archive[j], archive[i]]
  }

  return c.json(archive.map(t => serializePublicTalk(t, conf.speaker_visibility)))
})

// Talk order for voters is randomized client-side, per visit (see the
// voting page). This endpoint returns talks in a stable order and lets the client
// own presentation ordering.
conference.get('/talks', requireAuth, async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured yet' }, 404)

  const { results: talks } = await getTalksByConference(c.env.DB, conf.id)
  return c.json(talks.map(t => serializePublicTalk(t, conf.speaker_visibility)))
})

export default conference
