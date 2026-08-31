import { createMiddleware } from 'hono/factory'
import { getClerkUserId } from '../lib/clerk.js'
import type { Bindings, Variables } from '../index.js'

export const requireAuth = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const clerkUserId = await getClerkUserId(c.req.raw, c.env)

  if (!clerkUserId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Check if admin first
  const admin = await c.env.DB.prepare(
    'SELECT id FROM admin_users WHERE clerk_user_id = ?'
  ).bind(clerkUserId).first<{ id: string }>()

  if (admin) {
    c.set('clerkUserId', clerkUserId)
    c.set('role', 'admin')
    c.set('entityId', admin.id)
    return next()
  }

  // Fall back to voter
  const voter = await c.env.DB.prepare(
    'SELECT id FROM voters WHERE clerk_user_id = ?'
  ).bind(clerkUserId).first<{ id: string }>()

  if (!voter) {
    return c.json({ error: 'User not registered. Call /api/auth/sync first.' }, 403)
  }

  c.set('clerkUserId', clerkUserId)
  c.set('role', 'voter')
  c.set('entityId', voter.id)
  return next()
})

export const requireAdmin = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  return next()
})
