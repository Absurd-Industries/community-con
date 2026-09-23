import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import app from './index.js'
import { parseAndValidateCsv } from '@cc/db'
import type { Bindings } from './index.js'

/**
 * End-to-end over a real D1, because the parts worth testing here are the ones
 * that only exist once the rows are in the database: who can delete what, and
 * which ballots the tally keeps.
 */

const PASSWORD = 'test-password'
const CONFERENCE_ID = 'conf_test'
const hash = (seed: string) => seed.padEnd(64, '0').slice(0, 64)

const ALICE = hash('a1')
const BOB = hash('b2')
const GHOST = hash('c3')

const testEnv = env as unknown as Bindings

async function applySchema() {
  await testEnv.DB.exec(
    `DROP TABLE IF EXISTS ballots; DROP TABLE IF EXISTS valid_voters; DROP TABLE IF EXISTS organizer_tie_breaks; DROP TABLE IF EXISTS audit_logs; DROP TABLE IF EXISTS talks; DROP TABLE IF EXISTS conferences;`
  )
  await testEnv.DB.exec(
    `CREATE TABLE conferences (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, voting_opens_at INTEGER, voting_closes_at INTEGER, voting_force_status TEXT NOT NULL DEFAULT 'scheduled', votes_per_voter INTEGER NOT NULL DEFAULT 0, results_public INTEGER NOT NULL DEFAULT 0, speaker_visibility TEXT NOT NULL DEFAULT 'basic', ballot_locked_at INTEGER, ballot_talk_count INTEGER, created_at INTEGER NOT NULL);`
  )
  await testEnv.DB.exec(
    `CREATE TABLE talks (id TEXT PRIMARY KEY, conference_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, duration_minutes INTEGER NOT NULL, presenter_name TEXT NOT NULL, presenter_bio TEXT, presenter_email TEXT, talk_type TEXT, cfp_url TEXT, cfp_content TEXT, "references" TEXT, withdrawn_at INTEGER, withdrawal_reason TEXT, created_at INTEGER NOT NULL);`
  )
  await testEnv.DB.exec(
    `CREATE TABLE ballots (id TEXT PRIMARY KEY, conference_id TEXT NOT NULL, voter_hash TEXT NOT NULL, talk_ids TEXT NOT NULL, cast_at INTEGER NOT NULL);`
  )
  await testEnv.DB.exec(
    `CREATE TABLE valid_voters (conference_id TEXT NOT NULL, voter_hash TEXT NOT NULL, uploaded_at INTEGER NOT NULL, PRIMARY KEY (conference_id, voter_hash));`
  )
  await testEnv.DB.exec(
    `CREATE TABLE organizer_tie_breaks (id TEXT PRIMARY KEY, conference_id TEXT NOT NULL, selected_talk_id TEXT NOT NULL, tied_talk_ids TEXT NOT NULL, reason TEXT NOT NULL, admin_label TEXT NOT NULL DEFAULT 'organiser', created_at INTEGER NOT NULL);`
  )
  await testEnv.DB.exec(
    `CREATE TABLE audit_logs (id TEXT PRIMARY KEY, admin_label TEXT NOT NULL DEFAULT 'organiser', action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, details TEXT, created_at INTEGER NOT NULL);`
  )
}

async function seed({ votingOpen = true } = {}) {
  await testEnv.DB.prepare(
    `INSERT INTO conferences (id, name, votes_per_voter, voting_force_status, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(CONFERENCE_ID, 'Test Con', 2, votingOpen ? 'open' : 'closed', 1).run()

  await testEnv.DB.batch(
    ['t1', 't2', 't3'].map((id, index) =>
      testEnv.DB.prepare(
        `INSERT INTO talks (id, conference_id, title, duration_minutes, presenter_name, created_at) VALUES (?, ?, ?, 10, ?, ?)`
      ).bind(id, CONFERENCE_ID, `Talk ${id}`, `Speaker ${id}`, index)
    )
  )
}

const request = (path: string, init?: RequestInit) => app.request(path, init, testEnv as never)

const asAdmin = (path: string, init: RequestInit = {}) =>
  request(path, {
    ...init,
    headers: { 'X-Admin-Password': PASSWORD, 'Content-Type': 'application/json', ...init.headers },
  })

const castBallot = (voterHash: string, talkIds: string[]) =>
  request('/api/ballots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voter_hash: voterHash, talk_ids: talkIds }),
  })

beforeEach(async () => {
  await applySchema()
  await seed()
})

describe('casting a ballot', () => {
  it('accepts a ballot with no credentials of any kind', async () => {
    const response = await castBallot(ALICE, ['t1', 't2'])
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true, accepted: 2 })
  })

  it('answers a made-up pair exactly as it answers a real one', async () => {
    // The whole privacy argument rests on this. If the two differed, anyone
    // could use this endpoint to find out who holds a ticket.
    await asAdmin('/api/admin/voters', {
      method: 'PUT',
      body: JSON.stringify({ voter_hashes: [ALICE] }),
    })

    const real = await castBallot(ALICE, ['t1'])
    const invented = await castBallot(GHOST, ['t1'])

    expect(invented.status).toBe(real.status)
    expect(await invented.json()).toEqual(await real.json())
  })

  it('appends rather than overwriting when a voter changes their mind', async () => {
    await castBallot(ALICE, ['t1'])
    await castBallot(ALICE, ['t2'])

    const { count } = (await testEnv.DB.prepare(
      'SELECT COUNT(*) as count FROM ballots WHERE voter_hash = ?'
    ).bind(ALICE).first<{ count: number }>())!
    expect(count).toBe(2)
  })

  it('drops talk ids it does not recognise instead of failing the ballot', async () => {
    const response = await castBallot(ALICE, ['t1', 'not-a-talk'])
    expect(await response.json()).toEqual({ ok: true, accepted: 1 })
  })

  it('refuses more picks than the vote budget', async () => {
    const response = await castBallot(ALICE, ['t1', 't2', 't3'])
    expect(response.status).toBe(422)
  })

  it('refuses anything that is not a SHA-256 hash', async () => {
    const response = await castBallot('TICKET-1234', ['t1'])
    expect(response.status).toBe(422)
  })

  it('refuses once voting has closed', async () => {
    await testEnv.DB.prepare(
      `UPDATE conferences SET voting_force_status = 'closed' WHERE id = ?`
    ).bind(CONFERENCE_ID).run()
    const response = await castBallot(ALICE, ['t1'])
    expect(response.status).toBe(409)
  })
})

describe('the ballot spam brake', () => {
  const withLimiter = (limiter: unknown) =>
    app.request(
      '/api/ballots',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' },
        body: JSON.stringify({ voter_hash: ALICE, talk_ids: ['t1'] }),
      },
      { ...testEnv, BALLOT_LIMIT: limiter } as never
    )

  it('turns away a flood', async () => {
    const response = await withLimiter({ limit: async () => ({ success: false }) })
    expect(response.status).toBe(429)
  })

  it('lets an ordinary ballot through', async () => {
    const response = await withLimiter({ limit: async () => ({ success: true }) })
    expect(response.status).toBe(201)
  })

  it('fails open when the limiter itself breaks', async () => {
    // Losing a real vote is far worse than admitting some spam.
    const response = await withLimiter({
      limit: async () => { throw new Error('limiter down') },
    })
    expect(response.status).toBe(201)
  })

  it('still works with no limiter configured at all', async () => {
    const response = await castBallot(ALICE, ['t1'])
    expect(response.status).toBe(201)
  })
})

describe('talks CSV', () => {
  // Proposals are loaded BEFORE voting opens. The shared fixture opens voting,
  // which locks the ballot, so wind that back for these.
  beforeEach(async () => {
    await testEnv.DB.prepare(
      `UPDATE conferences SET voting_force_status = 'closed', ballot_locked_at = NULL WHERE id = ?`
    ).bind(CONFERENCE_ID).run()
  })

  const postCsv = (csv: string) => {
    const form = new FormData()
    form.append('file', new File([csv], 'talks.csv', { type: 'text/csv' }))
    return app.request(
      '/api/admin/talks/import',
      { method: 'POST', headers: { 'X-Admin-Password': PASSWORD }, body: form },
      testEnv as never
    )
  }

  it('imports a CSV', async () => {
    const response = await postCsv('title,presenter_name\nImported talk,Imported Speaker\n')
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ imported: 1 })
  })

  it('accepts the FOSS United column names', async () => {
    const response = await postCsv('session_title,speaker,track\nAliased talk,Alias Speaker,Community\n')
    expect(response.status).toBe(201)

    const talks = await (await asAdmin('/api/admin/talks')).json<Array<{ title: string; talk_type: string }>>()
    expect(talks.find(t => t.title === 'Aliased talk')?.talk_type).toBe('Community')
  })

  it('rejects a row with no title rather than importing a blank talk', async () => {
    const response = await postCsv('title,presenter_name\n,Nameless\n')
    expect(response.status).toBe(422)
  })

  it('exports the proposal list with ids, so the ballot log can be joined to it', async () => {
    const csv = await (await asAdmin('/api/admin/talks/export')).text()
    const [header, ...rows] = csv.trim().split('\n')
    expect(header).toBe(
      'id,title,description,duration_minutes,presenter_name,presenter_bio,presenter_email,talk_type,cfp_url,cfp_content,references'
    )
    expect(rows).toHaveLength(3)
    // The ids must be the ones the ballot log records.
    expect(rows.map(r => r.split(',')[0]).sort()).toEqual(['t1', 't2', 't3'])
  })

  it('can drop the id column for a file meant to be re-imported', async () => {
    const csv = await (await asAdmin('/api/admin/talks/export?ids=0')).text()
    expect(csv.split('\n')[0]).toBe(
      'title,description,duration_minutes,presenter_name,presenter_bio,presenter_email,talk_type,cfp_url,cfp_content,references'
    )
  })

  it('round-trips even with the id column present', async () => {
    const exported = await (await asAdmin('/api/admin/talks/export')).text()
    const before = (await (await asAdmin('/api/admin/talks')).json<unknown[]>()).length

    const response = await postCsv(exported)
    expect(response.status).toBe(201)

    const after = (await (await asAdmin('/api/admin/talks')).json<unknown[]>()).length
    expect(after).toBe(before * 2)
  })

  it('survives commas and quotes in a title', async () => {
    await postCsv('title,presenter_name\n"Rust, C++ and ""safety""",Someone\n')
    const csv = await (await asAdmin('/api/admin/talks/export')).text()
    const reimported = parseAndValidateCsv(csv)
    expect(reimported.errors).toEqual([])
    expect(reimported.rows.map(r => r.title)).toContain('Rust, C++ and "safety"')
  })

  it('refuses to import once the ballot is locked', async () => {
    await testEnv.DB.prepare(
      'UPDATE conferences SET ballot_locked_at = ? WHERE id = ?'
    ).bind(1, CONFERENCE_ID).run()

    const response = await postCsv('title,presenter_name\nToo late,Someone\n')
    expect(response.status).toBe(409)
  })

  it('still exports once the ballot is locked', async () => {
    await testEnv.DB.prepare(
      'UPDATE conferences SET ballot_locked_at = ? WHERE id = ?'
    ).bind(1, CONFERENCE_ID).run()

    expect((await asAdmin('/api/admin/talks/export')).status).toBe(200)
  })

  it('needs the organiser password to export', async () => {
    // The export carries presenter emails; it is not a public file.
    expect((await request('/api/admin/talks/export')).status).toBe(401)
  })
})

describe('the organiser door', () => {
  it('turns away a request with no password', async () => {
    const response = await request('/api/admin/talks')
    expect(response.status).toBe(401)
  })

  it('turns away a wrong password', async () => {
    const response = await request('/api/admin/talks', {
      headers: { 'X-Admin-Password': 'not-the-password' },
    })
    expect(response.status).toBe(401)
  })

  it('lets the right password through', async () => {
    const response = await asAdmin('/api/admin/session')
    expect(response.status).toBe(200)
  })

  it('stays shut when no password is configured at all', async () => {
    const response = await app.request(
      '/api/admin/talks',
      { headers: { 'X-Admin-Password': '' } },
      { ...testEnv, ADMIN_PASSWORD: '' } as never
    )
    expect(response.status).toBe(503)
  })

  it('leaves the voting routes open', async () => {
    expect((await request('/api/conference')).status).toBe(200)
    expect((await request('/api/talks/archive')).status).toBe(200)
  })
})

describe('the tally', () => {
  it('counts every ballot until a ticket list is loaded', async () => {
    await castBallot(ALICE, ['t1'])
    await castBallot(GHOST, ['t1'])

    const response = await asAdmin('/api/admin/results')
    const body = await response.json<{ talks: Array<{ id: string; vote_count: number }> }>()
    expect(body.talks.find(t => t.id === 't1')?.vote_count).toBe(2)
  })

  it('drops ballots from pairs that are not on the list', async () => {
    await castBallot(ALICE, ['t1'])
    await castBallot(GHOST, ['t1'])

    await asAdmin('/api/admin/voters', {
      method: 'PUT',
      body: JSON.stringify({ voter_hashes: [ALICE, BOB] }),
    })

    const body = await (await asAdmin('/api/admin/results')).json<{
      talks: Array<{ id: string; vote_count: number }>
      tally: { from_unknown_tickets: number; eligible_tickets: number }
    }>()
    expect(body.talks.find(t => t.id === 't1')?.vote_count).toBe(1)
    expect(body.tally.from_unknown_tickets).toBe(1)
    // Two tickets were claimed, even though only one of them voted.
    expect(body.tally.eligible_tickets).toBe(2)
  })

  it('counts only the latest ballot from each voter', async () => {
    await castBallot(ALICE, ['t1'])
    await new Promise(resolve => setTimeout(resolve, 2))
    await castBallot(ALICE, ['t2'])

    const body = await (await asAdmin('/api/admin/results')).json<{
      talks: Array<{ id: string; vote_count: number }>
      tally: { superseded: number; counted: number }
    }>()
    expect(body.talks.find(t => t.id === 't1')?.vote_count).toBe(0)
    expect(body.talks.find(t => t.id === 't2')?.vote_count).toBe(1)
    expect(body.tally.superseded).toBe(1)
    expect(body.tally.counted).toBe(1)
  })

  it('previews a ticket list without committing it', async () => {
    await castBallot(ALICE, ['t1'])
    await castBallot(GHOST, ['t1'])

    const preview = await (await asAdmin('/api/admin/voters/preview', {
      method: 'POST',
      body: JSON.stringify({ voter_hashes: [ALICE] }),
    })).json<{ summary: { counted: number } }>()
    expect(preview.summary.counted).toBe(1)

    // Nothing was saved, so the live results still count both.
    const stored = await (await asAdmin('/api/admin/voters')).json<{ count: number }>()
    expect(stored.count).toBe(0)
  })

  it('replaces the ticket list on re-upload rather than merging', async () => {
    await asAdmin('/api/admin/voters', { method: 'PUT', body: JSON.stringify({ voter_hashes: [ALICE] }) })
    await asAdmin('/api/admin/voters', { method: 'PUT', body: JSON.stringify({ voter_hashes: [BOB] }) })
    const stored = await (await asAdmin('/api/admin/voters')).json<{ count: number }>()
    expect(stored.count).toBe(1)
  })
})

describe('public results', () => {
  it('stay hidden until an organiser publishes them', async () => {
    expect((await request('/api/results')).status).toBe(403)
  })

  it('refuse to be published while voting is still open', async () => {
    const response = await asAdmin('/api/admin/results/publication', {
      method: 'PUT',
      body: JSON.stringify({ results_public: true }),
    })
    expect(response.status).toBe(409)
  })

  it('appear once voting is closed and they are published', async () => {
    await castBallot(ALICE, ['t1'])
    await testEnv.DB.prepare(
      `UPDATE conferences SET voting_force_status = 'closed' WHERE id = ?`
    ).bind(CONFERENCE_ID).run()
    await asAdmin('/api/admin/results/publication', {
      method: 'PUT',
      body: JSON.stringify({ results_public: true }),
    })

    const body = await (await request('/api/results')).json<{
      talks: Array<{ id: string; vote_count: number; rank: number }>
    }>()
    expect(body.talks[0]).toMatchObject({ id: 't1', vote_count: 1, rank: 1 })
  })
})

describe('resetting the vote', () => {
  it('needs the exact confirmation phrase', async () => {
    await castBallot(ALICE, ['t1'])
    const response = await asAdmin('/api/admin/conference/reset-ballot', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'yes' }),
    })
    expect(response.status).toBe(422)

    const { count } = (await testEnv.DB.prepare('SELECT COUNT(*) as count FROM ballots')
      .first<{ count: number }>())!
    expect(count).toBe(1)
  })

  it('clears the ballots and the ticket list together', async () => {
    await castBallot(ALICE, ['t1'])
    await asAdmin('/api/admin/voters', { method: 'PUT', body: JSON.stringify({ voter_hashes: [ALICE] }) })

    const response = await asAdmin('/api/admin/conference/reset-ballot', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'RESET VOTES' }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, votes_deleted: 1 })

    const stored = await (await asAdmin('/api/admin/voters')).json<{ count: number }>()
    expect(stored.count).toBe(0)
  })
})

describe('the ballot export', () => {
  it('hands over every ballot, superseded ones included', async () => {
    await castBallot(ALICE, ['t1'])
    await new Promise(resolve => setTimeout(resolve, 2))
    await castBallot(ALICE, ['t2'])

    const csv = await (await asAdmin('/api/admin/results/ballots.csv')).text()
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('voter_hash,cast_at_iso,cast_at_ms,talk_ids')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain(ALICE)
  })
})
