import { Hono } from 'hono'
import { logAdminAction } from '../../lib/audit.js'
import type { Bindings, Variables } from '../../index.js'

const adminUsers = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminUsers.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, created_at FROM admin_users ORDER BY created_at ASC'
  ).all<{ id: string; email: string; created_at: number }>()

  return c.json(results)
})

adminUsers.delete('/:id', async (c) => {
  const adminId = c.req.param('id')
  const currentAdminId = c.get('entityId')

  if (adminId === currentAdminId) {
    return c.json({ error: 'You cannot remove your own admin access.' }, 422)
  }

  const count = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM admin_users'
  ).first<{ count: number }>()

  if ((count?.count ?? 0) <= 1) {
    return c.json({ error: 'At least one admin must remain.' }, 422)
  }

  const target = await c.env.DB.prepare(
    'SELECT email FROM admin_users WHERE id = ?'
  ).bind(adminId).first<{ email: string }>()

  const result = await c.env.DB.prepare(
    'DELETE FROM admin_users WHERE id = ?'
  ).bind(adminId).run()

  if (result.meta.changes === 0) {
    return c.json({ error: 'Admin not found' }, 404)
  }

  await logAdminAction(c.env.DB, currentAdminId, 'remove', 'admin_user', adminId, {
    email: target?.email ?? null,
  })

  return c.json({ ok: true })
})

export default adminUsers
