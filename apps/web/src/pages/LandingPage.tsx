import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { formatDuration } from '../lib/time.js'
import { EVENT, SCHEDULE, formatIst, formatIstTime } from '../lib/event.js'
import { useEffect, useState } from 'react'
import ResultsList, { type PublicResultsResponse } from '../components/ResultsList.js'

interface Conference {
  name: string
  description: string | null
  voting_status: 'open' | 'closed'
  votes_per_voter: number
  voting_opens_at: number | null
  voting_closes_at: number | null
  results_public: boolean
  server_now: number
}

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function Step({ index, title, children }: {
  index: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="card flex gap-4 p-5">
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-sunken font-mono text-xs font-semibold text-ink"
      >
        {index}
      </span>
      <div className="min-w-0">
        <h3 className="text-[0.95rem] font-bold text-ink">{title}</h3>
        <div className="mt-1.5 text-sm leading-relaxed text-ink-light">{children}</div>
      </div>
    </li>
  )
}

const offsite = 'underline underline-offset-2 hover:text-ink'

export default function LandingPage() {
  const now = useNow()
  const { data: conference } = useQuery({
    queryKey: ['conference'],
    queryFn: () => apiFetch<Conference>('/api/conference'),
  })

  const isOpen = conference?.voting_status === 'open'
  const offset = conference ? conference.server_now - Date.now() : 0
  const serverNow = now + offset
  const slots = conference?.votes_per_voter ?? EVENT.slotCount

  /**
   * The page has three jobs over the event, and says only what's true now:
   *   voting   - before and during the vote: invite people to the ballot.
   *   counting - voting is over, results not out: nothing to click, say when.
   *   results  - results published: lead with them, right here.
   * "Over" means past the closing time, not merely closed: an organiser can
   * force voting closed before it opens, and that must still read as "voting".
   */
  const votingOver =
    !isOpen && conference?.voting_closes_at != null && serverNow > conference.voting_closes_at
  const phase: 'voting' | 'counting' | 'results' = conference?.results_public
    ? 'results'
    : votingOver
      ? 'counting'
      : 'voting'

  const target =
    phase === 'counting'
      ? SCHEDULE.resultsAt
      : isOpen
        ? conference?.voting_closes_at
        : conference?.voting_opens_at
  const showCountdown = target != null && target > serverNow

  const { data: results } = useQuery({
    queryKey: ['public-results'],
    queryFn: () => apiFetch<PublicResultsResponse>('/api/results'),
    enabled: phase === 'results',
    retry: false,
  })

  // "/#results" from the header: scroll once the list has actually rendered.
  const { hash } = useLocation()
  useEffect(() => {
    if (hash === '#results' && results) {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [hash, results])

  /**
   * Mirrors the list on the official Communi-Con page, and says so. Showing
   * the event's schedule unattributed is part of what made this site read like
   * a copy of that page rather than a tool for it.
   */
  const keyTimes: Array<{ label: string; when: string; extra?: React.ReactNode }> = [
    {
      label: 'Proposals close',
      when: formatIst(SCHEDULE.cfpClosesAt),
      extra: (
        <a href={EVENT.links.submit} target="_blank" rel="noreferrer" className={offsite}>
          Submit a proposal
        </a>
      ),
    },
    { label: 'Voting opens', when: formatIst(SCHEDULE.votingOpensAt) },
    { label: 'Voting closes', when: formatIst(SCHEDULE.votingClosesAt) },
    { label: 'Results', when: formatIst(SCHEDULE.resultsAt) },
    {
      label: 'On stage',
      when: `${formatIst(SCHEDULE.stageStartsAt)} to ${formatIstTime(SCHEDULE.stageEndsAt)}`,
      extra: EVENT.hall,
    },
  ]

  return (
    <div className="space-y-10">
      {/* Hero: say what this site is before anything else. */}
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-7 sm:p-9">
          <p className="eyebrow">
            {EVENT.conference} · {EVENT.name}
          </p>
          {/* nowrap on the name: otherwise narrow screens break it at its hyphen. */}
          {phase === 'results' ? (
            <>
              <h1 className="page-title mt-3 max-w-xl">
                The <span className="whitespace-nowrap">{EVENT.name}</span> line-up is in
              </h1>
              <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ink-light">
                {EVENT.conference} ticket holders picked these {slots} talks. Catch them on stage
                in {EVENT.hall} at {formatIstTime(SCHEDULE.stageStartsAt)}, {EVENT.slotMinutes}{' '}
                minutes each.
              </p>
            </>
          ) : phase === 'counting' ? (
            <>
              <h1 className="page-title mt-3 max-w-xl">Thanks for voting</h1>
              <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ink-light">
                Voting has closed. The votes are being checked against the ticket list, and the
                results go up here at {formatIstTime(SCHEDULE.resultsAt)}.
              </p>
            </>
          ) : (
            <>
              <h1 className="page-title mt-3 max-w-xl">
                Vote for the <span className="whitespace-nowrap">{EVENT.name}</span> talks
              </h1>
              <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ink-light">
                {EVENT.conference} ticket holders pick the talks. The {slots} with the most votes
                go on stage in {EVENT.hall}, {EVENT.slotMinutes} minutes each.
              </p>
            </>
          )}
          <div className="mt-6 flex flex-wrap gap-2.5">
            {phase === 'voting' && (
              <Link to="/vote" className="btn-primary">
                {isOpen ? 'Vote now' : 'Open the ballot'}
              </Link>
            )}
            {phase === 'results' && (
              <a href="#results" className="btn-primary">
                See the results
              </a>
            )}
            <a href={EVENT.links.event} target="_blank" rel="noreferrer" className="btn-outline">
              Official event page
              <i className="ph ph-arrow-up-right" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="card-ink flex flex-col justify-center p-7">
          {/* The festival's maze motif, tinted by this element's text colour. */}
          <div className="maze text-accent opacity-30" aria-hidden="true" />
          {phase === 'results' ? (
            <>
              <div className="relative">
                <p className="text-xs font-medium uppercase tracking-wide text-surface/60">
                  Voting has closed
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight">Results announced</p>
              </div>
              <dl className="relative mt-7 space-y-3 border-t border-white/15 pt-5 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-surface/60">Verified voters</dt>
                  <dd className="font-mono font-semibold">
                    {results?.stats.participating_voters ?? '…'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-surface/60">On stage</dt>
                  <dd className="text-right font-mono text-xs">
                    {formatIstTime(SCHEDULE.stageStartsAt)}, {EVENT.hall}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <div className="relative">
                <p className="text-xs font-medium uppercase tracking-wide text-surface/60">
                  {phase === 'counting'
                    ? showCountdown
                      ? 'Results in'
                      : 'Voting has closed'
                    : showCountdown
                      ? isOpen
                        ? 'Voting closes in'
                        : 'Voting opens in'
                      : 'Voting'}
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
                  {showCountdown
                    ? formatDuration(target! - serverNow)
                    : phase === 'counting'
                      ? 'Results soon'
                      : isOpen
                        ? 'Open'
                        : 'Closed'}
                </p>
              </div>
              <dl className="relative mt-7 border-t border-white/15 pt-5 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-surface/60">Votes per ticket</dt>
                  <dd className="font-mono font-semibold">{slots}</dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </section>

      {phase === 'results' && results && (
        <section id="results" className="scroll-mt-24">
          <h2 className="section-title">Results</h2>
          <p className="mb-4 mt-1 text-sm text-ink-faint">
            Verified against the official ticket list: {results.stats.participating_voters}{' '}
            voters, {results.stats.total_votes} votes.
          </p>
          <ResultsList talks={results.talks} slots={results.method.votes_per_voter} />
        </section>
      )}

      {/* Key times, credited to where they came from. */}
      <section>
        <h2 className="section-title mb-4">Key times</h2>
        <div className="card overflow-hidden">
          <dl className="divide-y divide-line">
            {keyTimes.map(row => (
              <div
                key={row.label}
                className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <dt className="text-sm font-medium text-ink">{row.label}</dt>
                <dd className="flex flex-wrap items-baseline gap-x-3 font-mono text-sm text-ink-light sm:justify-end">
                  <span>{row.when}</span>
                  {row.extra && <span className="font-sans text-ink-faint">{row.extra}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line bg-surface-raised px-5 py-3 text-xs text-ink-faint">
            All times IST. From the{' '}
            <a href={EVENT.links.event} target="_blank" rel="noreferrer" className={offsite}>
              official {EVENT.name} page
            </a>
            .
          </p>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="section-title mb-4">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          <Step index={1} title="Propose">
            <p>Anything you’re working on, in {EVENT.slotMinutes} minutes.</p>
          </Step>
          <Step index={2} title="Vote">
            <p>
              Pick up to {slots} talks. Change your mind as often as you like; only your last
              ballot counts.
            </p>
          </Step>
          <Step index={3} title="Watch">
            <p>The {slots} most voted talks go on stage in {EVENT.hall}.</p>
          </Step>
        </ol>
      </section>

      {/* The rules that usually get asked about */}
      <section>
        <h2 className="section-title mb-2">Questions people ask</h2>
        <div className="card px-5">
          <details className="faq-item">
            <summary>Do I need a ticket?</summary>
            <p>
              Yes, voting is for {EVENT.conference} ticket holders. You’ll need the ticket ID
              and the email address from your ticket email.
            </p>
          </details>
          <details className="faq-item">
            <summary>Why do you want my email?</summary>
            <p>
              A ticket is only yours once you claim it with an email, one address per
              ticket, so the pair is what makes you you. Your browser hashes the two
              together and sends just the hash. We couldn’t email you if we tried.
            </p>
          </details>
          <details className="faq-item">
            <summary>Will it tell me if my ticket is valid?</summary>
            <p>
              No, on purpose. If it said “invalid ticket”, anyone could sit outside and guess
              until something worked. We check tickets once, later, when we count. So copy
              both details carefully: a typo means your vote won’t count.
            </p>
          </details>
          <details className="faq-item">
            <summary>Can I vote more than once?</summary>
            <p>
              Submit as often as you like. Only your latest ballot counts, so resubmitting
              replaces your picks rather than adding to them.
            </p>
          </details>
          <details className="faq-item">
            <summary>Can I vote for my own talk?</summary>
            <p>
              Go ahead. One vote among hundreds won’t move the needle, and stopping you would
              mean linking proposals to tickets, which costs everyone their privacy.
            </p>
          </details>
          <details className="faq-item">
            <summary>Is my vote anonymous?</summary>
            <p>
              To us, yes: we never see your ticket or your email. FOSS United holds the ticket
              list, so when they verify the count they could match a ballot to a ticket.
              Results are only ever published as totals.
            </p>
          </details>
          <details className="faq-item">
            <summary>Who runs this?</summary>
            <p>
              <a href={EVENT.links.operator} target="_blank" rel="noreferrer" className={offsite}>
                {EVENT.operator}
              </a>
              , an independent community. {EVENT.name} itself is organised by
              FOSS United; this voting system is separate and shares no personal data with
              anyone, because it never has any.
            </p>
          </details>
        </div>
      </section>
    </div>
  )
}
