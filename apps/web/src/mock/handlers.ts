import {
  ballotTalkCount,
  getVotingStatus,
  isBallotLocked,
  parseAndValidateCsv,
  recommendedVotes,
  type Conference,
  type SpeakerVisibility,
  type Talk,
} from '@cc/db'
import { getStore, mutate, tally, voteCounts, type Ballot, type DemoStore } from './store.js'

/**
 * The demo's request router.
 *
 * Paths, methods and response shapes mirror apps/api/src/routes/* exactly, so
 * every page keeps its existing useQuery/useMutation calls and the real Worker
 * can be dropped back in by changing lib/api.ts alone.
 */

export class MockHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

const notFound = (what: string) => new MockHttpError(what, 404)

// ---------------------------------------------------------------------------
// Shared serialisation (mirrors apps/api/src/lib/talk-response.ts)
// ---------------------------------------------------------------------------

function serializePublicTalk(
  talk: Talk & { vote_count?: number; rank?: number },
  visibility: SpeakerVisibility
) {
  const result: Record<string, unknown> = {
    id: talk.id,
    title: talk.title,
    description: talk.description,
    talk_type: talk.talk_type,
    references: talk.references,
    withdrawn_at: talk.withdrawn_at,
    withdrawal_reason: talk.withdrawal_reason,
  }
  if (visibility !== 'hidden') result.presenter_name = talk.presenter_name
  if (visibility === 'full') {
    result.presenter_bio = talk.presenter_bio
    result.cfp_url = talk.cfp_url
  }
  if (talk.vote_count !== undefined) result.vote_count = talk.vote_count
  if (talk.rank !== undefined) result.rank = talk.rank
  return result
}

/** Competition ranking: equal vote totals share a rank, and the next rank skips. */
function rankTalks<T extends { vote_count: number }>(talks: T[]) {
  let previousVotes: number | undefined
  let previousRank = 0
  return talks.map((talk, index) => {
    const rank = talk.vote_count === previousVotes ? previousRank : index + 1
    previousVotes = talk.vote_count
    previousRank = rank
    return { ...talk, rank }
  })
}

function talksWithVoteCounts(store: DemoStore) {
  const counts = voteCounts(store)
  return store.talks
    .map(talk => ({ ...talk, vote_count: counts.get(talk.id) ?? 0 }))
    .sort((a, b) => b.vote_count - a.vote_count || b.created_at - a.created_at)
}

function voteStats(store: DemoStore) {
  const { ballots, summary } = tally(store)
  return {
    // Before an official list is loaded there is no denominator, so fall back
    // to "everyone who voted" rather than inventing a turnout figure.
    eligible_voters: summary.eligible_tickets ?? ballots.length,
    participating_voters: ballots.length,
    total_votes: ballots.reduce((sum, ballot) => sum + ballot.talk_ids.length, 0),
  }
}

function eligibleTalkCount(store: DemoStore) {
  return store.talks.filter(talk => talk.withdrawn_at === null).length
}

function logAdminAction(
  store: DemoStore,
  action: string,
  targetType: string,
  targetId: string | null,
  details: unknown
) {
  store.audit_logs.unshift({
    id: crypto.randomUUID(),
    admin_user_id: 'demo-admin',
    action,
    target_type: targetType,
    target_id: targetId,
    details: JSON.stringify(details),
    created_at: Date.now(),
  })
  // Admin pages page this at 50; keeping the tail forever just bloats storage.
  store.audit_logs = store.audit_logs.slice(0, 100)
}

const METHOD_NOTES =
  'Approval voting. Each ticket may select up to the vote budget; unused votes are allowed. ' +
  'Ballots are accepted without checking the ticket, and only the latest ballot from each ' +
  'valid ticket is counted at tally time. Ties share a vote total and are resolved by ' +
  'organiser scheduling judgment.'

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

type Handler = (ctx: { body: unknown; params: string[] }) => Promise<unknown>

const routes: Array<[string, RegExp, Handler]> = [
  // ---- Public ----
  ['GET', /^\/api\/conference$/, async () => {
    const store = await getStore()
    const conf = store.conference
    return {
      id: conf.id,
      name: conf.name,
      description: conf.description,
      voting_opens_at: conf.voting_opens_at,
      voting_closes_at: conf.voting_closes_at,
      voting_status: getVotingStatus(conf),
      votes_per_voter: conf.votes_per_voter,
      results_public: conf.results_public === 1,
      speaker_visibility: conf.speaker_visibility,
      server_now: Date.now(),
    }
  }],

  ['GET', /^\/api\/talks\/archive$/, async () => {
    const store = await getStore()
    // Scrambled per request, exactly like the Worker: no talk is disadvantaged
    // by a fixed order.
    const shuffled = [...store.talks]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.map(talk => serializePublicTalk(talk, store.conference.speaker_visibility))
  }],

  ['GET', /^\/api\/results$/, async () => {
    const store = await getStore()
    if (store.conference.results_public !== 1) {
      throw new MockHttpError('Results are not public yet', 403)
    }
    return {
      conference: { name: store.conference.name, description: store.conference.description },
      talks: rankTalks(talksWithVoteCounts(store)).map(talk =>
        serializePublicTalk(talk, store.conference.speaker_visibility)
      ),
      stats: voteStats(store),
      method: { type: 'approval', votes_per_voter: store.conference.votes_per_voter, notes: METHOD_NOTES },
    }
  }],

  /**
   * The one endpoint that does not exist in apps/api yet.
   *
   * BACKEND TODO: POST /api/ballots { voter_hash, talk_ids[] }
   *   - voter_hash is SHA-256 of the voter's ticket ID and email, hashed in the
   *     browser (lib/hash.ts `voterIdHash`). Neither raw value is ever sent.
   *   - accept blindly. Never signal whether the pair is real, in the status
   *     code, the body, or the response time.
   *   - append-only: a re-submission is a new row with its own cast_at, not an
   *     update.
   *   - the tally (see store.ts `tally`) decides what counts.
   */
  ['POST', /^\/api\/ballots$/, async ({ body }) => {
    const payload = (body ?? {}) as { voter_hash?: string; talk_ids?: string[] }
    const voterHash = payload.voter_hash?.trim()
    const talkIds = payload.talk_ids ?? []
    if (!voterHash) throw new MockHttpError('A ticket and email are required.', 422)

    return mutate(store => {
      const budget = store.conference.votes_per_voter
      if (getVotingStatus(store.conference) !== 'open') {
        throw new MockHttpError('Voting is closed.', 409)
      }
      if (talkIds.length > budget) {
        throw new MockHttpError(`You can select at most ${budget} talks.`, 422)
      }
      const known = new Set(store.talks.filter(t => t.withdrawn_at === null).map(t => t.id))
      const accepted = [...new Set(talkIds)].filter(id => known.has(id))

      const ballot: Ballot = {
        id: crypto.randomUUID(),
        voter_hash: voterHash,
        talk_ids: accepted,
        // Every ballot is stamped with when it was cast. The tally reads this
        // to decide which of a voter's submissions is the live one.
        cast_at: Date.now(),
      }
      store.ballots.push(ballot)
      return { ok: true, accepted: accepted.length }
    })
  }],

  // ---- Admin: conference ----
  ['GET', /^\/api\/admin\/conference$/, async () => {
    const store = await getStore()
    const conf = store.conference
    const displayed = ballotTalkCount(eligibleTalkCount(store), conf.ballot_talk_count)
    return {
      ...conf,
      eligible_talk_count: displayed,
      recommended_votes: recommendedVotes(displayed),
      ballot_locked: isBallotLocked(conf),
    }
  }],

  ['PUT', /^\/api\/admin\/conference$/, async ({ body }) => {
    const patch = (body ?? {}) as Partial<Conference>
    return mutate(store => {
      const conf = store.conference
      const candidate: Conference = {
        ...conf,
        ...patch,
        name: patch.name?.trim() || conf.name,
      }
      const willOpen = getVotingStatus(candidate) === 'open'
      const talkCount = ballotTalkCount(eligibleTalkCount(store), conf.ballot_talk_count)

      if (willOpen && candidate.votes_per_voter < 1) {
        throw new MockHttpError('Set at least 1 vote per voter before opening voting.', 422)
      }
      if (candidate.votes_per_voter > talkCount) {
        throw new MockHttpError(`Votes per voter cannot exceed the ${talkCount} eligible talks.`, 422)
      }
      if (willOpen && conf.results_public === 1) {
        throw new MockHttpError('Hide public results before reopening voting.', 409)
      }

      // The ballot locks the first time voting opens and stays locked, so the
      // rules cannot change underneath votes already cast.
      if (willOpen && candidate.ballot_locked_at === null) {
        candidate.ballot_locked_at = Date.now()
        candidate.ballot_talk_count = eligibleTalkCount(store)
      }

      store.conference = candidate
      logAdminAction(store, 'update', 'conference', conf.id, {
        votes_per_voter: candidate.votes_per_voter,
        voting_force_status: candidate.voting_force_status,
      })
      return candidate
    })
  }],

  ['POST', /^\/api\/admin\/conference\/reset-ballot$/, async ({ body }) => {
    const payload = (body ?? {}) as { confirmation?: string }
    if (payload.confirmation !== 'RESET VOTES') {
      throw new MockHttpError('Type RESET VOTES to confirm this destructive action.', 422)
    }
    return mutate(store => {
      const deleted = store.ballots.length
      store.ballots = []
      store.tie_breaks = []
      store.conference = {
        ...store.conference,
        ballot_locked_at: null,
        ballot_talk_count: null,
        voting_force_status: 'closed',
        voting_opens_at: null,
        voting_closes_at: null,
        results_public: 0,
      }
      logAdminAction(store, 'reset_ballot', 'conference', store.conference.id, { votes_deleted: deleted })
      return { ok: true, votes_deleted: deleted }
    })
  }],

  // ---- Admin: users + audit ----
  // There are no accounts in the preview, so this is a single placeholder row.
  ['GET', /^\/api\/admin\/users$/, async () => [
    { id: 'demo-admin', email: 'organiser@example.com (demo)', created_at: 0 },
  ]],

  ['DELETE', /^\/api\/admin\/users\/([^/]+)$/, async () => {
    throw new MockHttpError('Admin accounts are not part of the design preview.', 409)
  }],

  ['GET', /^\/api\/admin\/audit$/, async () => {
    const store = await getStore()
    return store.audit_logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
      admin_email: 'organiser@example.com (demo)',
    }))
  }],

  // ---- Admin: talks ----
  ['GET', /^\/api\/admin\/talks$/, async () => {
    const store = await getStore()
    return talksWithVoteCounts(store)
  }],

  ['POST', /^\/api\/admin\/talks$/, async ({ body }) => {
    const patch = (body ?? {}) as Partial<Talk>
    return mutate(store => {
      const talk = { ...blankTalk(store.conference.id), ...patch, id: crypto.randomUUID() } as Talk
      if (!talk.title?.trim()) throw new MockHttpError('title is required', 422)
      store.talks.unshift(talk)
      logAdminAction(store, 'create', 'talk', talk.id, { title: talk.title })
      return talk
    })
  }],

  ['PUT', /^\/api\/admin\/talks\/([^/]+)$/, async ({ body, params }) => {
    const patch = (body ?? {}) as Partial<Talk>
    return mutate(store => {
      const talk = store.talks.find(t => t.id === params[0])
      if (!talk) throw notFound('Talk not found')
      Object.assign(talk, patch, { id: talk.id, conference_id: talk.conference_id })
      logAdminAction(store, 'update', 'talk', talk.id, { title: talk.title })
      return talk
    })
  }],

  ['DELETE', /^\/api\/admin\/talks\/([^/]+)$/, async ({ params }) =>
    mutate(store => {
      const talk = store.talks.find(t => t.id === params[0])
      if (!talk) throw notFound('Talk not found')
      store.talks = store.talks.filter(t => t.id !== params[0])
      // Ballots keep their reference; the tally ignores ids it cannot resolve.
      logAdminAction(store, 'delete', 'talk', params[0], { title: talk.title })
      return { ok: true }
    })
  ],

  ['POST', /^\/api\/admin\/talks\/([^/]+)\/withdraw$/, async ({ body, params }) => {
    const payload = (body ?? {}) as { reason?: string }
    return mutate(store => {
      const talk = store.talks.find(t => t.id === params[0])
      if (!talk) throw notFound('Talk not found')
      talk.withdrawn_at = Date.now()
      talk.withdrawal_reason = payload.reason?.trim() || null
      logAdminAction(store, 'withdraw', 'talk', talk.id, { reason: talk.withdrawal_reason })
      return talk
    })
  }],

  ['POST', /^\/api\/admin\/talks\/import$/, async ({ body }) => {
    const csv = String(body ?? '')
    // Same parser the Worker uses - packages/db/src/csv.ts.
    const { rows, errors } = parseAndValidateCsv(csv)
    if (errors.length > 0) {
      throw new MockHttpError(
        errors.slice(0, 5).map(e => `row ${e.row}: ${e.message}`).join('; '),
        422
      )
    }
    return mutate(store => {
      const now = Date.now()
      const imported = rows.map((row, index) => ({
        ...blankTalk(store.conference.id),
        ...row,
        id: crypto.randomUUID(),
        created_at: now + index,
      })) as Talk[]
      store.talks = [...imported, ...store.talks]
      logAdminAction(store, 'import', 'talk', null, { imported: imported.length })
      return { imported: imported.length }
    })
  }],

  // ---- Admin: results ----
  ['GET', /^\/api\/admin\/results$/, async () => {
    const store = await getStore()
    return {
      talks: rankTalks(talksWithVoteCounts(store)),
      results_public: store.conference.results_public === 1,
      stats: voteStats(store),
      tie_breaks: store.tie_breaks,
      method: { type: 'approval', votes_per_voter: store.conference.votes_per_voter, notes: METHOD_NOTES },
    }
  }],

  ['PUT', /^\/api\/admin\/results\/publication$/, async ({ body }) => {
    const payload = (body ?? {}) as { results_public?: boolean }
    return mutate(store => {
      if (payload.results_public && getVotingStatus(store.conference) === 'open') {
        throw new MockHttpError('Close voting before publishing public results.', 409)
      }
      store.conference.results_public = payload.results_public ? 1 : 0
      logAdminAction(store, 'update_publication', 'results', store.conference.id, {
        results_public: Boolean(payload.results_public),
      })
      return { ok: true, results_public: Boolean(payload.results_public) }
    })
  }],

  ['POST', /^\/api\/admin\/results\/tie-breaks$/, async ({ body }) => {
    const payload = (body ?? {}) as {
      selected_talk_id?: string
      tied_talk_ids?: string[]
      reason?: string
    }
    return mutate(store => {
      if (getVotingStatus(store.conference) === 'open') {
        throw new MockHttpError('Close voting before recording an organizer tie-break.', 409)
      }
      const selected = payload.selected_talk_id ?? ''
      const tied = [...new Set(payload.tied_talk_ids ?? [])]
      const reason = payload.reason?.trim() ?? ''
      if (!reason) throw new MockHttpError('A tie-break reason is required.', 422)
      if (tied.length < 2 || !tied.includes(selected)) {
        throw new MockHttpError('Select one talk from a tie group containing at least two talks.', 422)
      }
      const counts = voteCounts(store)
      if (new Set(tied.map(id => counts.get(id) ?? 0)).size !== 1) {
        throw new MockHttpError('Tie-break talks must have equal community vote totals.', 422)
      }

      const record = {
        id: crypto.randomUUID(),
        conference_id: store.conference.id,
        selected_talk_id: selected,
        tied_talk_ids: tied,
        reason,
        admin_email: 'organiser@example.com (demo)',
        created_at: Date.now(),
      }
      store.tie_breaks.unshift(record)
      logAdminAction(store, 'record_tie_break', 'results', selected, { tied_talk_ids: tied, reason })
      return { ok: true, id: record.id }
    })
  }],

  ['GET', /^\/api\/admin\/results\/export$/, async () => {
    const store = await getStore()
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
    const rows = talksWithVoteCounts(store).map(talk =>
      [escape(talk.title), escape(talk.presenter_name), talk.vote_count].join(',')
    )
    const csv = ['title,presenter_name,vote_count', ...rows].join('\n')
    return new Blob([csv], { type: 'text/csv' })
  }],
]

function blankTalk(conferenceId: string): Talk {
  return {
    id: '',
    conference_id: conferenceId,
    title: '',
    description: null,
    duration_minutes: 5,
    presenter_name: '',
    presenter_bio: null,
    presenter_email: null,
    talk_type: null,
    cfp_url: null,
    cfp_content: null,
    references: null,
    withdrawn_at: null,
    withdrawal_reason: null,
    created_at: Date.now(),
  }
}

/** Visible thinking time, so loading and disabled states are demoable. */
const LATENCY_MS = 220

export async function handleRequest(
  method: string,
  path: string,
  body: unknown
): Promise<unknown> {
  await new Promise(resolve => setTimeout(resolve, LATENCY_MS))

  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue
    const match = pattern.exec(path)
    if (!match) continue
    return handler({ body, params: match.slice(1) })
  }

  throw new MockHttpError(`No demo handler for ${method} ${path}`, 404)
}
