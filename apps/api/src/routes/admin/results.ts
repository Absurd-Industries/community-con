import { Hono } from 'hono'
import { getConference, getTalksWithVoteCounts, getVoteStats } from '../../db/queries.js'
import { logAdminAction } from '../../lib/audit.js'
import type { Bindings, Variables } from '../../index.js'
import { rankTalks } from '../../lib/talk-response.js'
import { getVotingStatus } from '@cc/db'
import { validateTieBreak } from '../../lib/conference-policy.js'

const adminResults = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminResults.get('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const { results: talks } = await getTalksWithVoteCounts(c.env.DB, conf.id)
  const stats = await getVoteStats(c.env.DB, conf.id)
  const { results: tieBreaks } = await c.env.DB.prepare(`
    SELECT tb.*, a.email as admin_email
    FROM organizer_tie_breaks tb
    LEFT JOIN admin_users a ON a.id = tb.admin_user_id
    WHERE tb.conference_id = ? ORDER BY tb.created_at DESC
  `).bind(conf.id).all()

  return c.json({
    talks: rankTalks(talks),
    results_public: conf.results_public === 1,
    stats,
    tie_breaks: tieBreaks.map((tieBreak: Record<string, unknown>) => ({
      ...tieBreak,
      tied_talk_ids: JSON.parse(String(tieBreak.tied_talk_ids)),
    })),
    method: {
      type: 'approval',
      votes_per_voter: conf.votes_per_voter,
      notes: 'Voters may select up to the vote budget. Unused votes are allowed. Ties share the same vote total and can be resolved by organizer scheduling judgment.',
    },
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

  const { results: allResults } = await getTalksWithVoteCounts(c.env.DB, conf.id)
  const tiedTalks = allResults.filter(talk => tiedTalkIds.includes(talk.id))
  const validationError = validateTieBreak(selectedTalkId, tiedTalkIds, tiedTalks)
  if (validationError) return c.json({ error: validationError }, 422)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO organizer_tie_breaks
      (id, conference_id, selected_talk_id, tied_talk_ids, reason, admin_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, conf.id, selectedTalkId, JSON.stringify(tiedTalkIds), reason, c.get('entityId'), Date.now()).run()
  await logAdminAction(c.env.DB, c.get('entityId'), 'record_tie_break', 'results', selectedTalkId, {
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

  await logAdminAction(c.env.DB, c.get('entityId'), 'update_publication', 'results', conf.id, {
    results_public: body.results_public,
  })

  return c.json({ ok: true, results_public: body.results_public })
})

adminResults.get('/export', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const { results: talks } = await getTalksWithVoteCounts(c.env.DB, conf.id)

  const header = 'title,presenter_name,vote_count'
  const csvRows = talks.map(t =>
    [
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.presenter_name.replace(/"/g, '""')}"`,
      t.vote_count,
    ].join(',')
  )

  const csv = [header, ...csvRows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="results.csv"',
    },
  })
})

export default adminResults
