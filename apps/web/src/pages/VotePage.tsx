import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api.js'
import { submitBallot } from '../lib/ballot.js'
import { useTicket } from '../lib/ticket.js'
import { formatDateTime, formatDuration } from '../lib/time.js'
import { createVisitTalkOrder } from '../lib/talk-order.js'
import TicketGate from '../components/TicketGate.js'
import TalkDetailModal, { type TalkDetail } from '../components/TalkDetailModal.js'
import VoteCompleteModal from '../components/VoteCompleteModal.js'
import { TalkGridSkeleton } from '../components/TalkCardSkeleton.js'

interface Conference {
  id: string
  name: string
  description: string | null
  voting_status: 'open' | 'closed'
  votes_per_voter: number
  voting_opens_at: number | null
  voting_closes_at: number | null
  server_now: number
}

type Talk = TalkDetail

const SELECTION_KEY = 'community-con:selection'

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

function readSelection(): string[] {
  try {
    const raw = window.sessionStorage.getItem(SELECTION_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export default function VotePage() {
  const now = useNow()
  const { ticket, ready, signIn, signOut } = useTicket()
  const [detailTalk, setDetailTalk] = useState<Talk | null>(null)
  const [filter, setFilter] = useState<string>('All')
  const [selected, setSelected] = useState<string[]>(readSelection)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const { data: conference, isLoading: confLoading } = useQuery({
    queryKey: ['conference'],
    queryFn: () => apiFetch<Conference>('/api/conference'),
  })

  // The public archive endpoint - no identity required, which is the whole
  // point: the ballot is anonymous until a ticket hash is attached to it.
  const { data: talks = [], isLoading: talksLoading } = useQuery({
    queryKey: ['talks-archive'],
    queryFn: () => apiFetch<Talk[]>('/api/talks/archive'),
    enabled: !!conference,
  })

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selected))
    } catch {
      /* selection just won't survive a reload */
    }
  }, [selected])

  const votesTotal = conference?.votes_per_voter ?? 0
  const votesUsed = selected.length
  const selectedIds = useMemo(() => new Set(selected), [selected])

  const clientServerOffset = useMemo(
    () => (conference ? conference.server_now - Date.now() : 0),
    [conference?.server_now]
  )
  const effectiveNow = now + clientServerOffset

  const talkTypes = useMemo(() => {
    const set = new Set<string>()
    talks.forEach(talk => talk.talk_type && set.add(talk.talk_type))
    return ['All', ...Array.from(set)]
  }, [talks])

  // Per-visit order: anything already picked when this visit started stays
  // pinned on top; the undecided tail is shuffled once. Frozen for the visit so
  // picking a talk never makes the cards jump, and reshuffled on the next visit
  // so no proposal stays permanently buried.
  const [sessionOrder, setSessionOrder] = useState<string[] | null>(null)
  useEffect(() => {
    if (sessionOrder || talks.length === 0) return
    setSessionOrder(createVisitTalkOrder(talks.map(t => t.id), new Set(selected), Math.random))
    // `selected` is read as the visit's starting state, deliberately not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talks, sessionOrder])

  const orderedTalks = useMemo(() => {
    if (!sessionOrder) return talks
    const byId = new Map(talks.map(talk => [talk.id, talk]))
    const known = new Set(sessionOrder)
    const ordered = sessionOrder.map(id => byId.get(id)).filter((t): t is Talk => Boolean(t))
    return [...ordered, ...talks.filter(talk => !known.has(talk.id))]
  }, [talks, sessionOrder])

  const visibleTalks =
    filter === 'All' ? orderedTalks : orderedTalks.filter(talk => talk.talk_type === filter)

  if (!ready) return null
  if (!ticket) return <TicketGate onSubmit={signIn} />

  if (confLoading || talksLoading) {
    return (
      <div className="space-y-6">
        <div className="card p-6">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton mt-3 h-9 w-3/4" />
          <div className="skeleton mt-3 h-4 w-full" />
        </div>
        <TalkGridSkeleton count={6} withActions />
      </div>
    )
  }
  if (!conference) {
    return <div className="empty-state">Nothing to vote on yet.</div>
  }

  const isOpen = conference.voting_status === 'open'
  const votingOpensAt = formatDateTime(conference.voting_opens_at)
  const votingClosesAt = formatDateTime(conference.voting_closes_at)
  const countdownTarget = isOpen ? conference.voting_closes_at : conference.voting_opens_at
  const showCountdown = countdownTarget !== null && countdownTarget > effectiveNow
  const atBudget = votesUsed >= votesTotal

  function toggle(talkId: string) {
    setSubmitError(null)
    setSelected(current =>
      current.includes(talkId)
        ? current.filter(id => id !== talkId)
        : current.length < votesTotal
          ? [...current, talkId]
          : current
    )
  }

  async function handleSubmit() {
    if (!ticket || submitting || selected.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitBallot(ticket.hash, selected)
      setSavedAt(Date.now())
      setJustSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit your ballot.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
        <div className="card min-w-0 flex-1 p-6">
          <p className="eyebrow">Ballot</p>
          <h1 className="page-title mt-2">{conference.name}</h1>
          {conference.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-light">
              {conference.description}
            </p>
          )}
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
            <i className="ph ph-ticket" aria-hidden="true" />
            Voting as <span className="font-mono text-ink">{ticket.masked}</span>
            <button onClick={signOut} className="underline underline-offset-2 hover:text-ink">
              use a different ticket
            </button>
          </p>
        </div>
        <div className="card-ink flex shrink-0 flex-col justify-center px-6 py-5 sm:w-52">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-surface/60">
            <i className="ph-bold ph-clock" aria-hidden="true" />
            {showCountdown ? (isOpen ? 'Closes in' : 'Opens in') : 'Voting'}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
            {showCountdown
              ? formatDuration(countdownTarget! - effectiveNow)
              : isOpen
                ? 'Open'
                : 'Closed'}
          </p>
        </div>
      </div>

      {/* Status */}
      {isOpen ? (
        <div className="card flex flex-wrap items-baseline gap-x-2 gap-y-1 px-5 py-4 text-sm">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <span className="h-2 w-2 rounded-full bg-positive" aria-hidden="true" />
            Pick up to {votesTotal} talks
          </span>
          <span className="text-ink-light">
            {votingClosesAt ? `Voting closes ${votingClosesAt}.` : 'Voting is open.'} You can
            resubmit as often as you like — only your last ballot counts.
          </span>
        </div>
      ) : (
        <div className="card flex flex-wrap items-baseline gap-x-2 gap-y-1 px-5 py-4 text-sm">
          <span className="flex items-center gap-2 font-semibold text-ink">
            <span className="h-2 w-2 rounded-full bg-ink/25" aria-hidden="true" />
            Voting is closed
          </span>
          <span className="text-ink-light">
            {votingOpensAt ? `Opens ${votingOpensAt}.` : 'Check back later.'}
          </span>
        </div>
      )}

      {submitError && (
        <div className="status-error" role="alert">
          {submitError}
        </div>
      )}

      {/* Filter pills */}
      {talkTypes.length > 2 && (
        <div className="flex flex-wrap items-center gap-2">
          {talkTypes.map(type => {
            const active = filter === type
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={[
                  'rounded-full border px-3.5 py-1.5 font-sans text-xs font-medium transition-colors',
                  active
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-surface text-ink-faint hover:border-ink/30 hover:text-ink',
                ].join(' ')}
              >
                {type}
                {type !== 'All' && (
                  <span className="ml-1.5 opacity-60">
                    {talks.filter(talk => talk.talk_type === type).length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {visibleTalks.length === 0 ? (
        <div className="empty-state">
          <i className="ph ph-tray text-3xl opacity-40" aria-hidden="true" />
          <p className="section-title text-ink">No proposals here yet</p>
          <p className="text-sm">Check back soon.</p>
        </div>
      ) : (
        <div className="card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTalks.map((talk, index) => {
            const picked = selectedIds.has(talk.id)
            const withdrawn = Boolean(talk.withdrawn_at)
            const canPick = isOpen && !withdrawn && (picked || !atBudget)
            return (
              <div
                key={talk.id}
                className={[
                  'card card-hover animate-fade-in-up flex min-w-0 flex-col p-5',
                  picked ? 'ring-2 ring-ink' : '',
                ].join(' ')}
                style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
              >
                <div className="mb-2 flex items-center gap-2">
                  {talk.talk_type && <span className="tag tag-muted">{talk.talk_type}</span>}
                  {picked && (
                    <span className="tag tag-stamp">
                      <i className="ph-fill ph-check mr-1" aria-hidden="true" /> Picked
                    </span>
                  )}
                  {withdrawn && <span className="tag tag-danger">Withdrawn</span>}
                </div>
                <h2 className="text-base font-bold leading-snug text-ink">{talk.title}</h2>
                {talk.presenter_name && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-faint">
                    <i className="ph ph-user" aria-hidden="true" /> {talk.presenter_name}
                  </p>
                )}
                {talk.description && (
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-light">
                    {talk.description}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setDetailTalk(talk)} className="btn btn-outline btn-sm flex-1">
                    Details
                  </button>
                  <button
                    disabled={!canPick}
                    onClick={() => toggle(talk.id)}
                    className={['btn btn-sm flex-1', picked ? 'btn-outline' : 'btn-primary'].join(' ')}
                  >
                    {picked ? 'Remove' : 'Pick'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {detailTalk && <TalkDetailModal talk={detailTalk} onClose={() => setDetailTalk(null)} />}

      {/* Ballot bar */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md">
          {/* Left padding clears the floating demo launcher until the viewport is
              wide enough for the centred container to sit clear of it. */}
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-3 py-3 pl-24 pr-4 sm:pl-28 sm:pr-6 xl:px-6">
            <div className="min-w-[9rem] flex-1">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-ink-faint">Your ballot</span>
                <span className="font-mono tabular-nums text-ink">
                  {votesUsed} / {votesTotal}
                </span>
              </div>
              <div className="progress mt-1.5" aria-hidden="true">
                <div
                  className="progress-fill"
                  style={{ width: `${votesTotal > 0 ? (votesUsed / votesTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
            <p className="order-last w-full text-xs text-ink-faint sm:order-none sm:w-auto sm:max-w-[16rem]">
              {savedAt
                ? `Submitted ${formatDateTime(savedAt)}. Resubmit any time to replace it.`
                : atBudget
                  ? 'Ballot full — submit when you’re ready.'
                  : `${votesTotal - votesUsed} more to pick.`}
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting || selected.length === 0}
              className="btn-primary shrink-0"
            >
              {submitting ? 'Submitting…' : savedAt ? 'Resubmit ballot' : 'Submit ballot'}
            </button>
          </div>
        </div>
      )}

      {justSubmitted && (
        <VoteCompleteModal
          votesTotal={selected.length}
          deadline={votingClosesAt}
          onClose={() => setJustSubmitted(false)}
        />
      )}
    </div>
  )
}
