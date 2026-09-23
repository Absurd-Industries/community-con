import { Hono } from 'hono'
import type { App } from '../../index.js'

const adminAudit = new Hono<App>()

adminAudit.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, admin_label, action, target_type, target_id, details, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 50
  `).all<{
    id: string
    admin_label: string
    action: string
    target_type: string
    target_id: string | null
    details: string | null
    created_at: number
  }>()

  return c.json(results.map(row => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null,
  })))
})

export default adminAudit
