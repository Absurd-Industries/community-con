import { Hono } from 'hono'
import type { Bindings, Variables } from '../../index.js'

const adminAudit = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminAudit.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT
      l.id,
      l.action,
      l.target_type,
      l.target_id,
      l.details,
      l.created_at,
      a.email as admin_email
    FROM audit_logs l
    LEFT JOIN admin_users a ON a.id = l.admin_user_id
    ORDER BY l.created_at DESC
    LIMIT 50
  `).all<{
    id: string
    action: string
    target_type: string
    target_id: string | null
    details: string | null
    created_at: number
    admin_email: string | null
  }>()

  return c.json(results.map(row => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null,
  })))
})

export default adminAudit
