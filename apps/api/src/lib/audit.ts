/**
 * What organisers did, and when.
 *
 * The ballot log says what voters submitted. This says what the people running
 * the vote changed - the two together are what an independent checker reads.
 */
export async function logAdminAction(
  db: D1Database,
  adminLabel: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details?: unknown
) {
  await db.prepare(`
    INSERT INTO audit_logs (id, admin_label, action, target_type, target_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    adminLabel,
    action,
    targetType,
    targetId,
    details === undefined ? null : JSON.stringify(details),
    Date.now()
  ).run()
}
