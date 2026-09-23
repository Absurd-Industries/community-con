import { Hono } from 'hono'
import { getConference, tallyConference } from '../../db/queries.js'
import type { App } from '../../index.js'
import { logAdminAction } from '../../lib/audit.js'
import { isBallotLocked, parseAndValidateCsv, talksToCsv, type Talk } from '@cc/db'

const adminTalks = new Hono<App>()

adminTalks.get('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const { talks } = await tallyConference(c.env.DB, conf.id)
  return c.json(talks)
})

adminTalks.post('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  if (isBallotLocked(conf)) return c.json({ error: 'The ballot is locked; talks cannot be added after voting starts.' }, 409)

  const body = await c.req.json<{
    title: string
    description?: string
    duration_minutes?: number
    presenter_name: string
    presenter_bio?: string
    presenter_email?: string
    talk_type?: string | null
    cfp_url?: string | null
    cfp_content?: string | null
    references?: string | null
  }>()

  const errors: string[] = []
  if (!body.title?.trim()) errors.push('title is required')
  if (!body.presenter_name?.trim()) errors.push('presenter_name is required')
  if (body.duration_minutes !== undefined && (!Number.isInteger(body.duration_minutes) || body.duration_minutes < 0)) {
    errors.push('duration_minutes must be a non-negative integer')
  }
  if (errors.length > 0) return c.json({ error: errors.join(', ') }, 422)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO talks (id, conference_id, title, description, duration_minutes, presenter_name, presenter_bio, presenter_email, talk_type, cfp_url, cfp_content, "references", created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, conf.id,
    body.title.trim(),
    body.description ?? null,
    body.duration_minutes ?? 0,
    body.presenter_name.trim(),
    body.presenter_bio ?? null,
    body.presenter_email ?? null,
    body.talk_type ?? null,
    body.cfp_url ?? null,
    body.cfp_content ?? null,
    body.references ?? null,
    Date.now()
  ).run()

  const talk = await c.env.DB.prepare('SELECT * FROM talks WHERE id = ?').bind(id).first()
  await logAdminAction(c.env.DB, c.get('adminLabel'), 'create', 'talk', id, {
    title: body.title.trim(),
    presenter_name: body.presenter_name.trim(),
  })
  return c.json(talk, 201)
})

/**
 * The proposal list as CSV.
 *
 * Same columns the importer reads, so this round-trips: export, edit in a
 * spreadsheet, import back. Registered before /:id so the word "export" is
 * never mistaken for a talk id.
 *
 * Unlike the results export this carries presenter_email, which is why it sits
 * behind the organiser password.
 */
adminTalks.get('/export', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM talks WHERE conference_id = ? ORDER BY created_at ASC'
  ).bind(conf.id).all<Talk>()

  // ?ids=0 drops the id column, for a file meant only to be re-imported.
  const withId = c.req.query('ids') !== '0'

  return new Response(talksToCsv(results, { withId }), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="proposals.csv"',
    },
  })
})

adminTalks.post('/import', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  if (isBallotLocked(conf)) return c.json({ error: 'The ballot is locked; talks cannot be imported after voting starts.' }, 409)

  const contentType = c.req.header('content-type') ?? ''
  let csvText: string

  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    csvText = await c.req.text()
  } else {
    const formData = await c.req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return c.json({ error: 'Send CSV as file upload (multipart/form-data field "file") or text/csv body' }, 422)
    }
    csvText = await (file as File).text()
  }

  const { rows, errors } = parseAndValidateCsv(csvText)

  if (errors.length > 0) {
    return c.json({ error: 'CSV validation failed', details: errors }, 422)
  }

  if (rows.length === 0) {
    return c.json({ error: 'CSV contains no data rows' }, 422)
  }

  const now = Date.now()
  const stmts = rows.map(row =>
    c.env.DB.prepare(`
      INSERT INTO talks (id, conference_id, title, description, duration_minutes, presenter_name, presenter_bio, presenter_email, talk_type, cfp_url, cfp_content, "references", created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), conf.id,
      row.title, row.description, row.duration_minutes,
      row.presenter_name, row.presenter_bio, row.presenter_email,
      row.talk_type, row.cfp_url, row.cfp_content, row.references,
      now
    )
  )

  await c.env.DB.batch(stmts)

  await logAdminAction(c.env.DB, c.get('adminLabel'), 'import', 'talk', null, {
    imported: rows.length,
  })

  return c.json({ ok: true, imported: rows.length }, 201)
})

adminTalks.put('/:id', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  if (isBallotLocked(conf)) return c.json({ error: 'The ballot is locked; talk content cannot change after voting starts.' }, 409)

  const talkId = c.req.param('id')
  const existing = await c.env.DB.prepare(
    'SELECT * FROM talks WHERE id = ? AND conference_id = ?'
  ).bind(talkId, conf.id).first<Talk>()
  if (!existing) return c.json({ error: 'Talk not found' }, 404)

  const body = await c.req.json<{
    title?: string
    description?: string | null
    duration_minutes?: number
    presenter_name?: string
    presenter_bio?: string | null
    presenter_email?: string | null
    talk_type?: string | null
    cfp_url?: string | null
    cfp_content?: string | null
    references?: string | null
  }>()

  if (body.duration_minutes !== undefined && (!Number.isInteger(body.duration_minutes) || body.duration_minutes < 0)) {
    return c.json({ error: 'duration_minutes must be a non-negative integer' }, 422)
  }

  await c.env.DB.prepare(`
    UPDATE talks SET
      title = ?,
      description = ?,
      duration_minutes = ?,
      presenter_name = ?,
      presenter_bio = ?,
      presenter_email = ?,
      talk_type = ?,
      cfp_url = ?,
      cfp_content = ?,
      "references" = ?
    WHERE id = ?
  `).bind(
    body.title ?? existing.title,
    body.description !== undefined ? body.description : existing.description,
    body.duration_minutes ?? existing.duration_minutes,
    body.presenter_name ?? existing.presenter_name,
    body.presenter_bio !== undefined ? body.presenter_bio : existing.presenter_bio,
    body.presenter_email !== undefined ? body.presenter_email : existing.presenter_email,
    body.talk_type !== undefined ? body.talk_type : existing.talk_type,
    body.cfp_url !== undefined ? body.cfp_url : existing.cfp_url,
    body.cfp_content !== undefined ? body.cfp_content : existing.cfp_content,
    body.references !== undefined ? body.references : existing.references,
    talkId
  ).run()

  const updated = await c.env.DB.prepare('SELECT * FROM talks WHERE id = ?').bind(talkId).first()
  await logAdminAction(c.env.DB, c.get('adminLabel'), 'update', 'talk', talkId, {
    before: {
      title: existing.title,
      presenter_name: existing.presenter_name,
    },
    after: {
      title: body.title ?? existing.title,
      presenter_name: body.presenter_name ?? existing.presenter_name,
    },
  })
  return c.json(updated)
})

adminTalks.delete('/:id', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  if (isBallotLocked(conf)) return c.json({ error: 'The ballot is locked. Withdraw the talk instead of deleting it.' }, 409)

  const talkId = c.req.param('id')
  const existing = await c.env.DB.prepare(
    'SELECT id, title FROM talks WHERE id = ? AND conference_id = ?'
  ).bind(talkId, conf.id).first<{ id: string; title: string }>()
  if (!existing) return c.json({ error: 'Talk not found' }, 404)

  // Ballots are append-only and are not edited here, even though one may name
  // this talk. The tally ignores ids it cannot resolve, so a deleted talk
  // simply stops being counted - and the ballot stays exactly as it was cast.
  await c.env.DB.prepare('DELETE FROM talks WHERE id = ?').bind(talkId).run()

  await logAdminAction(c.env.DB, c.get('adminLabel'), 'delete', 'talk', talkId, {
    title: existing.title,
  })

  return c.json({ ok: true })
})

adminTalks.post('/:id/withdraw', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)
  const talkId = c.req.param('id')
  const body = await c.req.json<{ reason?: string }>()
  const reason = body.reason?.trim()
  if (!reason) return c.json({ error: 'A withdrawal reason is required.' }, 422)

  const result = await c.env.DB.prepare(`
    UPDATE talks SET withdrawn_at = ?, withdrawal_reason = ?
    WHERE id = ? AND conference_id = ? AND withdrawn_at IS NULL
  `).bind(Date.now(), reason, talkId, conf.id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Active talk not found' }, 404)

  await logAdminAction(c.env.DB, c.get('adminLabel'), 'withdraw', 'talk', talkId, { reason })
  return c.json({ ok: true })
})

export default adminTalks
