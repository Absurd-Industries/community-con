import { Hono } from 'hono'
import { getConference, getEligibleTalkCount } from '../../db/queries.js'
import { logAdminAction } from '../../lib/audit.js'
import type { Bindings, Variables } from '../../index.js'
import { ballotTalkCount, getVotingStatus, isBallotLocked, recommendedVotes, type SpeakerVisibility } from '@cc/db'
import { conferencePatchTouchesLockedBallot, validateVoteAllowance } from '../../lib/conference-policy.js'

const adminConference = new Hono<{ Bindings: Bindings; Variables: Variables }>()
const FORCE_STATUSES = new Set(['open', 'closed', 'scheduled'])

type ConferenceBody = {
  name?: string
  description?: string | null
  voting_opens_at?: number | null
  voting_closes_at?: number | null
  voting_force_status?: string
  votes_per_voter?: number
  speaker_visibility?: SpeakerVisibility
}

function validateConferenceBody(body: ConferenceBody, requireName: boolean) {
  const errors: string[] = []

  if (requireName || body.name !== undefined) {
    if (!body.name?.trim()) errors.push('name is required')
  }

  if (body.voting_force_status !== undefined && !FORCE_STATUSES.has(body.voting_force_status)) {
    errors.push('voting_force_status must be scheduled, open, or closed')
  }

  if (body.voting_opens_at !== undefined && body.voting_opens_at !== null && !Number.isInteger(body.voting_opens_at)) {
    errors.push('voting_opens_at must be an integer timestamp or null')
  }

  if (body.voting_closes_at !== undefined && body.voting_closes_at !== null && !Number.isInteger(body.voting_closes_at)) {
    errors.push('voting_closes_at must be an integer timestamp or null')
  }

  if (body.votes_per_voter !== undefined && (!Number.isInteger(body.votes_per_voter) || body.votes_per_voter < 0)) {
    errors.push('votes_per_voter must be a non-negative integer')
  }

  if (body.speaker_visibility !== undefined && !['hidden', 'basic', 'full'].includes(body.speaker_visibility)) {
    errors.push('speaker_visibility must be hidden, basic, or full')
  }

  const opens = body.voting_opens_at
  const closes = body.voting_closes_at
  if (opens !== undefined && opens !== null && closes !== undefined && closes !== null && opens > closes) {
    errors.push('voting_opens_at must be before voting_closes_at')
  }

  return errors
}

adminConference.get('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json(null, 404)
  const eligibleTalkCount = await getEligibleTalkCount(c.env.DB, conf.id)
  const displayedTalkCount = ballotTalkCount(eligibleTalkCount, conf.ballot_talk_count)
  return c.json({
    ...conf,
    eligible_talk_count: displayedTalkCount,
    recommended_votes: recommendedVotes(displayedTalkCount),
    ballot_locked: isBallotLocked(conf),
  })
})

adminConference.post('/', async (c) => {
  const existing = await getConference(c.env.DB)
  if (existing) return c.json({ error: 'Conference already exists. Use PUT to update.' }, 409)

  const body = await c.req.json<ConferenceBody>()

  const errors = validateConferenceBody(body, true)
  if (errors.length > 0) return c.json({ error: errors.join(', ') }, 422)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO conferences (id, name, description, voting_opens_at, voting_closes_at, voting_force_status, votes_per_voter, results_public, speaker_visibility, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(
    id,
    body.name!.trim(),
    body.description ?? null,
    body.voting_opens_at ?? null,
    body.voting_closes_at ?? null,
    body.voting_force_status ?? 'scheduled',
    body.votes_per_voter ?? 0,
    body.speaker_visibility ?? 'basic',
    Date.now()
  ).run()

  const conf = await getConference(c.env.DB)
  await logAdminAction(c.env.DB, c.get('entityId'), 'create', 'conference', conf?.id ?? id, {
    name: body.name!.trim(),
    votes_per_voter: body.votes_per_voter ?? 0,
  })
  return c.json(conf, 201)
})

adminConference.put('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference exists. Use POST to create.' }, 404)

  const body = await c.req.json<ConferenceBody>()

  if (isBallotLocked(conf) && conferencePatchTouchesLockedBallot(body as Record<string, unknown>)) {
    return c.json({ error: 'The ballot is locked because voting has started. Reset voting before changing ballot settings.' }, 409)
  }

  const candidateOpens = body.voting_opens_at !== undefined ? body.voting_opens_at : conf.voting_opens_at
  const candidateCloses = body.voting_closes_at !== undefined ? body.voting_closes_at : conf.voting_closes_at
  const errors = validateConferenceBody({
    ...body,
    voting_opens_at: candidateOpens,
    voting_closes_at: candidateCloses,
  }, false)
  if (errors.length > 0) return c.json({ error: errors.join(', ') }, 422)

  const eligibleTalkCount = await getEligibleTalkCount(c.env.DB, conf.id)
  const candidate = {
    ...conf,
    voting_opens_at: candidateOpens,
    voting_closes_at: candidateCloses,
    voting_force_status: (body.voting_force_status ?? conf.voting_force_status) as typeof conf.voting_force_status,
    votes_per_voter: body.votes_per_voter ?? conf.votes_per_voter,
  }
  const willOpen = getVotingStatus(candidate) === 'open'
  const validationTalkCount = ballotTalkCount(eligibleTalkCount, conf.ballot_talk_count)
  const allowanceError = validateVoteAllowance(candidate.votes_per_voter, validationTalkCount, willOpen)
  if (allowanceError) return c.json({ error: allowanceError }, 422)
  if (willOpen && conf.results_public === 1) {
    return c.json({ error: 'Hide public results before reopening voting.' }, 409)
  }

  const name = body.name !== undefined ? body.name.trim() : null

  await c.env.DB.prepare(`
    UPDATE conferences SET
      name = COALESCE(?, name),
      description = ?,
      voting_opens_at = ?,
      voting_closes_at = ?,
      voting_force_status = COALESCE(?, voting_force_status),
      votes_per_voter = COALESCE(?, votes_per_voter)
      , speaker_visibility = COALESCE(?, speaker_visibility)
      , ballot_locked_at = COALESCE(ballot_locked_at, ?)
      , ballot_talk_count = COALESCE(ballot_talk_count, ?)
    WHERE id = ?
  `).bind(
    name,
    body.description !== undefined ? body.description : conf.description,
    body.voting_opens_at !== undefined ? body.voting_opens_at : conf.voting_opens_at,
    body.voting_closes_at !== undefined ? body.voting_closes_at : conf.voting_closes_at,
    body.voting_force_status ?? null,
    body.votes_per_voter ?? null,
    body.speaker_visibility ?? null,
    willOpen ? Date.now() : null,
    willOpen ? eligibleTalkCount : null,
    conf.id
  ).run()

  const updated = await getConference(c.env.DB)
  await logAdminAction(c.env.DB, c.get('entityId'), 'update', 'conference', conf.id, {
    before: {
      name: conf.name,
      voting_opens_at: conf.voting_opens_at,
      voting_closes_at: conf.voting_closes_at,
      voting_force_status: conf.voting_force_status,
      votes_per_voter: conf.votes_per_voter,
      speaker_visibility: conf.speaker_visibility,
    },
    after: {
      name: updated?.name,
      voting_opens_at: updated?.voting_opens_at,
      voting_closes_at: updated?.voting_closes_at,
      voting_force_status: updated?.voting_force_status,
      votes_per_voter: updated?.votes_per_voter,
      speaker_visibility: updated?.speaker_visibility,
    },
  })
  return c.json(updated)
})

adminConference.post('/reset-ballot', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference exists.' }, 404)
  const body = await c.req.json<{ confirmation?: string }>()
  if (body.confirmation !== 'RESET VOTES') {
    return c.json({ error: 'Type RESET VOTES to confirm this destructive action.' }, 422)
  }

  const voteCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM votes v
    INNER JOIN talks t ON t.id = v.talk_id
    WHERE t.conference_id = ?
  `).bind(conf.id).first<{ count: number }>()

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM organizer_tie_breaks WHERE conference_id = ?').bind(conf.id),
    c.env.DB.prepare('DELETE FROM votes WHERE talk_id IN (SELECT id FROM talks WHERE conference_id = ?)').bind(conf.id),
    c.env.DB.prepare(`UPDATE conferences SET ballot_locked_at = NULL, ballot_talk_count = NULL, voting_force_status = 'closed',
      voting_opens_at = NULL, voting_closes_at = NULL, results_public = 0 WHERE id = ?`).bind(conf.id),
  ])
  await logAdminAction(c.env.DB, c.get('entityId'), 'reset_ballot', 'conference', conf.id, {
    votes_deleted: voteCount?.count ?? 0,
  })
  return c.json({ ok: true, votes_deleted: voteCount?.count ?? 0 })
})

export default adminConference
