import type { Bindings, Variables } from '../index.js'

export async function logAdminAction(
  db: D1Database,
  adminUserId: Variables['entityId'],
  action: string,
  targetType: string,
  targetId: string | null,
  details?: unknown
) {
  await db.prepare(`
    INSERT INTO audit_logs (id, admin_user_id, action, target_type, target_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    adminUserId,
    action,
    targetType,
    targetId,
    details === undefined ? null : JSON.stringify(details),
    Date.now()
  ).run()
}

export type AuditEnv = Pick<Bindings, 'DB'>
