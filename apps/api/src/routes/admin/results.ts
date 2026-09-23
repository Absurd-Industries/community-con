import { Hono } from 'hono'
import { getConference, tallyConference, voteStats } from '../../db/queries.js'
import { logAdminAction } from '../../lib/audit.js'
import type { App } from '../../index.js'
import { getVotingStatus, rankTalks } from '@cc/db'
import { validateTieBreak } from '../../lib/conference-policy.js'
import { METHOD_NOTES } from '../public.js'

const adminResults = new Hono<App>()

adminResults.get('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const result = await tallyConference(c.env.DB, conf.id)
  const { results: tieBreaks } = await c.env.DB.prepare(
    'SELECT * FROM organizer_tie_breaks WHERE conference_id = ? ORDER BY created_at DESC'
  ).bind(conf.id).all()

  return c.json({
    talks: rankTalks(result.talks),
    results_public: conf.results_public === 1,
    stats: voteStats(result),
    tally: result.summary,
    tie_breaks: tieBreaks.map((tieBreak: Record<string, unknown>) => ({
      ...tieBreak,
      tied_talk_ids: JSON.parse(String(tieBreak.tied_talk_ids)),
    })),
    method: { type: 'approval', votes_per_voter: conf.votes_per_voter, notes: METHOD_NOTES },
  })
})

adminResults.post('/tie-breaks', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  if (getVotingStatus(conf) === 'open') {
    return c.json({ error: 'Close voting before recording an organizer tie-break.' }, 409)
  }

  const body = await c.req.json<{ selected_talk_id?: string; tied_talk_ids?: string[]; reason?: string }>()
  const selectedTalkId = body.selected_talk_id ?? ''
  const tiedTalkIds = [...new Set(body.tied_talk_ids ?? [])]
  const reason = body.reason?.trim() ?? ''
  if (!reason) return c.json({ error: 'A tie-break reason is required.' }, 422)

  const { talks } = await tallyConference(c.env.DB, conf.id)
  const tiedTalks = talks.filter(talk => tiedTalkIds.includes(talk.id))
  const validationError = validateTieBreak(selectedTalkId, tiedTalkIds, tiedTalks)
  if (validationError) return c.json({ error: validationError }, 422)

  const adminLabel = c.get('adminLabel')
  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO organizer_tie_breaks
      (id, conference_id, selected_talk_id, tied_talk_ids, reason, admin_label, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, conf.id, selectedTalkId, JSON.stringify(tiedTalkIds), reason, adminLabel, Date.now()).run()
  await logAdminAction(c.env.DB, adminLabel, 'record_tie_break', 'results', selectedTalkId, {
    tied_talk_ids: tiedTalkIds,
    reason,
  })
  return c.json({ ok: true, id }, 201)
})

adminResults.put('/publication', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const body = await c.req.json<{ results_public: boolean }>()

  if (body.results_public && getVotingStatus(conf) === 'open') {
    return c.json({ error: 'Close voting before publishing public results.' }, 409)
  }

  await c.env.DB.prepare(
    'UPDATE conferences SET results_public = ? WHERE id = ?'
  ).bind(body.results_public ? 1 : 0, conf.id).run()

  await logAdminAction(c.env.DB, c.get('adminLabel'), 'update_publication', 'results', conf.id, {
    results_public: body.results_public,
  })

  return c.json({ ok: true, results_public: body.results_public })
})

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`

adminResults.get('/export', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const { talks } = await tallyConference(c.env.DB, conf.id)
  const csv = [
    'title,presenter_name,vote_count',
    ...talks.map(t => [csvCell(t.title), csvCell(t.presenter_name), t.vote_count].join(',')),
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="results.csv"',
    },
  })
})

/**
 * The raw ballot log, for an independent check.
 *
 * Every ballot ever submitted, superseded ones included, in the order they were
 * cast. Someone who has the official list of claimed tickets can hash each pair
 * themselves, apply the rule in @cc/db `tallyBallots`, and arrive at the same
 * numbers without trusting this deployment.
 *
 * There is nothing personal in it. A voter_hash is SHA-256 of a ticket and an
 * email that were never sent here, and it can only be recognised by someone who
 * already knows the pair.
 */
adminResults.get('/ballots.csv', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const { results } = await c.env.DB.prepare(
    'SELECT voter_hash, talk_ids, cast_at FROM ballots WHERE conference_id = ? ORDER BY cast_at ASC'
  ).bind(conf.id).all<{ voter_hash: string; talk_ids: string; cast_at: number }>()

  const csv = [
    'voter_hash,cast_at_iso,cast_at_ms,talk_ids',
    ...results.map(row =>
      [
        row.voter_hash,
        new Date(row.cast_at).toISOString(),
        row.cast_at,
        csvCell(JSON.parse(row.talk_ids).join(' ')),
      ].join(',')
    ),
  ].join('\n')

  await logAdminAction(c.env.DB, c.get('adminLabel'), 'export_ballots', 'results', conf.id, {
    ballots: results.length,
  })

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="ballots.csv"',
    },
  })
})

export default adminResults
