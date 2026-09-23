import { Hono } from 'hono'
import publicRoutes from './routes/public.js'
import adminConferenceRoutes from './routes/admin/conference.js'
import adminTalksRoutes from './routes/admin/talks.js'
import adminResultsRoutes from './routes/admin/results.js'
import adminAuditRoutes from './routes/admin/audit.js'
import adminVotersRoutes from './routes/admin/voters.js'
import { requireAdminPassword } from './lib/admin-auth.js'

/**
 * The Communi-Con voting API.
 *
 * Two audiences, two levels of access, and nothing in between:
 *
 *   Voters    - no account, no login, no cookie. A ballot arrives carrying a
 *               hash of a ticket and an email that were never sent, and is
 *               accepted without question. See routes/public.ts.
 *
 *   Organisers - one shared password in ADMIN_PASSWORD, handed out by whoever
 *               runs the vote. Not a user system; it is a lock on the door of
 *               the room where votes can be deleted.
 *
 * This Worker also serves the site itself. Anything that is not /api/* falls
 * through to the static assets, so the voting page and the API share one origin
 * and there is no CORS to configure.
 */

export type Bindings = {
  DB: D1Database
  /** The organisers' shared password. Set with `wrangler secret put`. */
  ADMIN_PASSWORD: string
  ASSETS: Fetcher
  /** Ballot spam brake. Absent in tests and local dev; see routes/public.ts. */
  BALLOT_LIMIT?: RateLimit
}

export type Variables = {
  /** What to write in the audit log. There are no accounts to name. */
  adminLabel: string
}

export type App = { Bindings: Bindings; Variables: Variables }

const app = new Hono<App>()

app.get('/api/health', c => c.json({ ok: true }))

app.route('/api', publicRoutes)

const admin = new Hono<App>()
admin.use('*', requireAdminPassword)
admin.route('/conference', adminConferenceRoutes)
admin.route('/talks', adminTalksRoutes)
admin.route('/results', adminResultsRoutes)
admin.route('/audit', adminAuditRoutes)
admin.route('/voters', adminVotersRoutes)
/** Does this password work? The organiser login screen asks before showing anything. */
admin.get('/session', c => c.json({ ok: true }))
app.route('/api/admin', admin)

app.notFound(c =>
  c.req.path.startsWith('/api/')
    ? c.json({ error: `No route for ${c.req.method} ${c.req.path}` }, 404)
    : c.env.ASSETS.fetch(c.req.raw)
)

app.onError((error, c) => {
  console.error('[community-con]', error)
  return c.json({ error: 'Something went wrong on our end.' }, 500)
})

export default app
