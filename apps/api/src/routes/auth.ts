import { Hono } from 'hono'
import { createClerkClient } from '@clerk/backend'
import { getClerkUserId } from '../lib/clerk.js'
import { isAdminEmail } from '../lib/admin-email.js'
import type { Bindings, Variables } from '../index.js'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

function getPrimaryEmail(user: Awaited<ReturnType<ReturnType<typeof createClerkClient>['users']['getUser']>>) {
  const primary = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)
  return primary ?? user.emailAddresses[0] ?? null
}

function isVerifiedEmail(email: ReturnType<typeof getPrimaryEmail>) {
  return email?.verification?.status === 'verified'
}

auth.post('/sync', async (c) => {
  const clerkUserId = await getClerkUserId(c.req.raw, c.env)
  if (!clerkUserId) return c.json({ error: 'Unauthorized' }, 401)

  // Already an admin
  const existingAdmin = await c.env.DB.prepare(
    'SELECT id FROM admin_users WHERE clerk_user_id = ?'
  ).bind(clerkUserId).first<{ id: string }>()
  if (existingAdmin) return c.json({ ok: true, role: 'admin' })

  // Dev bypass: no Clerk to query, so use a fixed local email and skip verification.
  let email: string
  if (c.env.DEV_NO_AUTH === 'true') {
    email = 'dev@localhost'
  } else {
    // Fetch the user's email from Clerk (needed for both voter creation and admin check)
    const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY })
    const user = await clerk.users.getUser(clerkUserId)
    const primaryEmail = getPrimaryEmail(user)
    email = primaryEmail?.emailAddress ?? ''

    if (!email || !isVerifiedEmail(primaryEmail)) {
      return c.json({ error: 'A verified email is required before this account can be synced.' }, 422)
    }
  }

  // Bootstrap access: the first synced user becomes the initial admin.
  const firstAdmin = await c.env.DB.prepare(`
    INSERT INTO admin_users (id, clerk_user_id, email, created_at)
    SELECT ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM admin_users)
  `).bind(crypto.randomUUID(), clerkUserId, email, Date.now()).run()
  if (firstAdmin.meta.changes > 0) {
    await c.env.DB.prepare('DELETE FROM voters WHERE clerk_user_id = ?').bind(clerkUserId).run()
    return c.json({ ok: true, role: 'admin' })
  }

  // Also auto-promote if email matches one of the configured admin emails.
  if (isAdminEmail(email, c.env.ADMIN_EMAIL)) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO admin_users (id, clerk_user_id, email, created_at) VALUES (?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), clerkUserId, email, Date.now()).run()
    await c.env.DB.prepare('DELETE FROM voters WHERE clerk_user_id = ?').bind(clerkUserId).run()
    return c.json({ ok: true, role: 'admin' })
  }

  // Register as voter — INSERT OR IGNORE handles concurrent calls safely
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO voters (id, clerk_user_id, email, created_at) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), clerkUserId, email, Date.now()).run()

  return c.json({ ok: true, role: 'voter' })
})

auth.get('/me', async (c) => {
  const clerkUserId = await getClerkUserId(c.req.raw, c.env)
  if (!clerkUserId) return c.json({ error: 'Unauthorized' }, 401)

  const admin = await c.env.DB.prepare(
    'SELECT id, email FROM admin_users WHERE clerk_user_id = ?'
  ).bind(clerkUserId).first<{ id: string; email: string }>()
  if (admin) return c.json({ role: 'admin', id: admin.id, email: admin.email })

  const voter = await c.env.DB.prepare(
    'SELECT id, email FROM voters WHERE clerk_user_id = ?'
  ).bind(clerkUserId).first<{ id: string; email: string }>()
  if (voter) return c.json({ role: 'voter', id: voter.id, email: voter.email })

  return c.json({ error: 'User not registered. Call /api/auth/sync first.' }, 403)
})

export default auth
