import { Hono } from 'hono'
import { getConference, getTalksWithVoteCounts, getVoteStats } from '../db/queries.js'
import type { Bindings, Variables } from '../index.js'
import { rankTalks, serializePublicTalk } from '../lib/talk-response.js'

const results = new Hono<{ Bindings: Bindings; Variables: Variables }>()

results.get('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  if (conf.results_public !== 1) {
    return c.json({ error: 'Results are not public yet' }, 403)
  }

  const { results: talks } = await getTalksWithVoteCounts(c.env.DB, conf.id)
  const rankedTalks = rankTalks(talks)
  const stats = await getVoteStats(c.env.DB, conf.id)

  return c.json({
    conference: {
      name: conf.name,
      description: conf.description,
    },
    talks: rankedTalks.map(talk => serializePublicTalk(talk, conf.speaker_visibility)),
    stats,
    method: {
      type: 'approval',
      votes_per_voter: conf.votes_per_voter,
      notes: 'Voters could select up to the vote budget. Unused votes were allowed. Ties share the same vote total and can be resolved by organizer scheduling judgment.',
    },
  })
})

export default results
