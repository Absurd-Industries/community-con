import { Hono } from 'hono'
import authRoutes from './routes/auth.js'
import conferenceRoutes from './routes/conference.js'
import voteRoutes from './routes/votes.js'
import publicResultsRoutes from './routes/results.js'
import { requireAuth, requireAdmin } from './middleware/auth.js'
import adminConferenceRoutes from './routes/admin/conference.js'
import adminSlotTypesRoutes from './routes/admin/slot-types.js'
import adminTalksRoutes from './routes/admin/talks.js'
import adminResultsRoutes from './routes/admin/results.js'
import adminUsersRoutes from './routes/admin/users.js'
import adminAuditRoutes from './routes/admin/audit.js'
import { parseAllowedOrigins } from './lib/allowed-origins.js'

export type Bindings = {
  DB: D1Database
  CLERK_SECRET_KEY: string
  CLERK_PUBLISHABLE_KEY: string
  ALLOWED_ORIGIN: string
  ADMIN_EMAIL: string
  DEV_NO_AUTH: string
}

export type Variables = {
  clerkUserId: string
  role: 'voter' | 'admin'
  entityId: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') ?? ''
  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGIN)
  const isAllowedOrigin = allowedOrigins.includes(origin)
  const requestedHeaders = c.req.header('Access-Control-Request-Headers')

  if (c.req.method === 'OPTIONS') {
    const headers = new Headers({
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,HEAD,PUT,POST,DELETE,PATCH',
      'Vary': 'Origin, Access-Control-Request-Headers',
    })
    if (isAllowedOrigin) headers.set('Access-Control-Allow-Origin', origin)
    if (requestedHeaders) headers.set('Access-Control-Allow-Headers', requestedHeaders)
    return new Response(null, { status: 204, headers })
  }

  await next()
  if (isAllowedOrigin) c.header('Access-Control-Allow-Origin', origin)
  c.header('Access-Control-Allow-Credentials', 'true')
  c.header('Vary', 'Origin', { append: true })
})

app.get('/api/health', (c) => c.json({ ok: true }))
app.route('/api/auth', authRoutes)
app.route('/api', conferenceRoutes)
app.route('/api/votes', voteRoutes)
app.route('/api/results', publicResultsRoutes)

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>()
admin.use('*', requireAuth, requireAdmin)
admin.route('/conference', adminConferenceRoutes)
admin.route('/slot-types', adminSlotTypesRoutes)
admin.route('/talks', adminTalksRoutes)
admin.route('/results', adminResultsRoutes)
admin.route('/users', adminUsersRoutes)
admin.route('/audit', adminAuditRoutes)
app.route('/api/admin', admin)

export default app
