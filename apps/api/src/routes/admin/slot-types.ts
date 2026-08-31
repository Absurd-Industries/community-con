import { Hono } from 'hono'
import { getConference, getSlotTypes } from '../../db/queries.js'
import { logAdminAction } from '../../lib/audit.js'
import type { Bindings, Variables } from '../../index.js'

const adminSlotTypes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminSlotTypes.get('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const { results } = await getSlotTypes(c.env.DB, conf.id)
  return c.json(results)
})

adminSlotTypes.put('/', async (c) => {
  const conf = await getConference(c.env.DB)
  if (!conf) return c.json({ error: 'No conference configured' }, 404)

  const body = await c.req.json<Array<{ duration_minutes: number; count: number }>>()

  if (!Array.isArray(body)) {
    return c.json({ error: 'Body must be an array of slot types' }, 422)
  }

  const durations = new Set<number>()
  for (const slot of body) {
    if (!Number.isInteger(slot.duration_minutes) || slot.duration_minutes <= 0) {
      return c.json({ error: 'Each slot must have a positive integer duration_minutes' }, 422)
    }
    if (!Number.isInteger(slot.count) || slot.count <= 0) {
      return c.json({ error: 'Each slot must have a positive integer count' }, 422)
    }
    if (durations.has(slot.duration_minutes)) {
      return c.json({ error: `Duplicate slot duration: ${slot.duration_minutes} minutes` }, 422)
    }
    durations.add(slot.duration_minutes)
  }

  const votesPerVoter = body.reduce((sum, s) => sum + s.count, 0)
  const { results: beforeSlotTypes } = await getSlotTypes(c.env.DB, conf.id)

  // Replace all slot types atomically
  const stmts = [
    c.env.DB.prepare('DELETE FROM slot_types WHERE conference_id = ?').bind(conf.id),
    ...body.map(slot =>
      c.env.DB.prepare(
        'INSERT INTO slot_types (id, conference_id, duration_minutes, count) VALUES (?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), conf.id, slot.duration_minutes, slot.count)
    ),
    c.env.DB.prepare(
      'UPDATE conferences SET votes_per_voter = ? WHERE id = ?'
    ).bind(votesPerVoter, conf.id),
  ]

  await c.env.DB.batch(stmts)

  const { results } = await getSlotTypes(c.env.DB, conf.id)
  await logAdminAction(c.env.DB, c.get('entityId'), 'update', 'slot_types', conf.id, {
    before: {
      slot_types: beforeSlotTypes.map(slot => ({
        duration_minutes: slot.duration_minutes,
        count: slot.count,
      })),
      votes_per_voter: conf.votes_per_voter,
    },
    after: {
      slot_types: results.map(slot => ({
        duration_minutes: slot.duration_minutes,
        count: slot.count,
      })),
      votes_per_voter: votesPerVoter,
    },
  })
  return c.json({ slot_types: results, votes_per_voter: votesPerVoter })
})

export default adminSlotTypes
