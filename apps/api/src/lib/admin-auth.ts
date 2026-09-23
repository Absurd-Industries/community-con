import type { MiddlewareHandler } from 'hono'
import type { App } from '../index.js'

/**
 * The organiser door.
 *
 * One shared password, set as a Cloudflare secret and handed to the people
 * running the vote. It is deliberately not a login system: there are no
 * accounts anywhere in this project, and adding one for four organisers would
 * be more moving parts than the thing it protects.
 *
 * What it protects is real, though. Behind this middleware are the calls that
 * delete talks, publish results and wipe every ballot.
 */

const PASSWORD_HEADER = 'X-Admin-Password'

/**
 * Compare without leaking how much of the password was right.
 *
 * A plain `===` bails out at the first wrong character, and the time it took to
 * bail is a measurable hint. This looks at every byte either way.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  // Length itself is not secret, but returning early on it would still short
  // out the loop below, so fold it into the result instead.
  let mismatch = left.length ^ right.length
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return mismatch === 0
}

export const requireAdminPassword: MiddlewareHandler<App> = async (c, next) => {
  const expected = c.env.ADMIN_PASSWORD

  // An unset secret must not mean "everyone is an organiser". Closed is the
  // only safe reading of a missing lock.
  if (!expected) {
    return c.json(
      { error: 'The organiser password is not configured on this deployment.' },
      503
    )
  }

  const supplied = c.req.header(PASSWORD_HEADER) ?? ''
  if (!supplied || !constantTimeEqual(supplied, expected)) {
    return c.json({ error: 'Wrong organiser password.' }, 401)
  }

  // Free-text, supplied by the browser, shown only in the audit log. Trimmed to
  // keep a pasted essay out of the log; never trusted for anything.
  c.set('adminLabel', (c.req.header('X-Admin-Label') ?? 'organiser').trim().slice(0, 60) || 'organiser')
  await next()
}

export { constantTimeEqual }
