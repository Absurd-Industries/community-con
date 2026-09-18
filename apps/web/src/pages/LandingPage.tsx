import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { formatDuration } from '../lib/time.js'
import { EVENT, SCHEDULE, formatIst, formatIstDayTime, formatIstTime } from '../lib/event.js'
import { useEffect, useState } from 'react'

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

function Step({ index, title, when, children }: {
  index: number
  title: string
  when: string
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
        <p className="mt-0.5 font-mono text-xs text-ink-faint">{when}</p>
        <div className="mt-2 text-sm leading-relaxed text-ink-light">{children}</div>
      </div>
    </li>
  )
}

export default function LandingPage() {
  const now = useNow()
  const { data: conference } = useQuery({
    queryKey: ['conference'],
    queryFn: () => apiFetch<Conference>('/api/conference'),
  })

  const isOpen = conference?.voting_status === 'open'
  const target = isOpen ? conference?.voting_closes_at : conference?.voting_opens_at
  const offset = conference ? conference.server_now - Date.now() : 0
  const showCountdown = target != null && target > now + offset
  const slots = conference?.votes_per_voter ?? EVENT.slotCount

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-7 sm:p-9">

          <h1 className="page-title mt-3 max-w-xl">{EVENT.tagline}</h1>
          <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ink-light">
            Propose a talk. Vote for the ones you want to see. The {slots} favourites go up
            in {EVENT.hall} in front of {EVENT.audience} people.
          </p>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-5 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Slots</dt>
              <dd className="mt-0.5 font-semibold text-ink">{slots} talks</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Each</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {EVENT.slotMinutes} minutes, no Q&amp;A
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">On stage</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {formatIst(SCHEDULE.stageStartsAt, { weekday: undefined })}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/vote" className="btn-primary">
              {isOpen ? 'Vote now' : 'Open the ballot'}
            </Link>
            <a
              href={EVENT.links.submit}
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
            >
              Propose a talk
              <i className="ph ph-arrow-up-right" aria-hidden="true" />
            </a>
            {conference?.results_public && (
              <Link to="/results" className="btn-ghost">
                See the results
              </Link>
            )}
          </div>
        </div>

        <div className="card-ink flex flex-col justify-center p-7">
          {/* The festival's maze motif, tinted by this element's text colour. */}
          <div className="maze text-accent opacity-30" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-wide text-surface/60">
              {showCountdown ? (isOpen ? 'Voting closes in' : 'Voting opens in') : 'Voting'}
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
              {showCountdown
                ? formatDuration(target! - (now + offset))
                : isOpen
                  ? 'Open'
                  : 'Closed'}
            </p>
          </div>
          <dl className="relative mt-7 space-y-3 border-t border-white/15 pt-5 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-surface/60">Votes per ticket</dt>
              <dd className="font-mono font-semibold">{slots}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-surface/60">Voting closes</dt>
              <dd className="text-right font-mono text-xs">
                {formatIst(SCHEDULE.votingClosesAt)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-surface/60">Results</dt>
              <dd className="text-right font-mono text-xs">
                {formatIst(SCHEDULE.resultsAt)}
              </dd>
            </div>
          </dl>
          <p className="relative mt-4 text-[0.7rem] leading-relaxed text-surface/50">
            All times IST, at {EVENT.venue}.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="section-title mb-4">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          <Step
            index={1}
            title="Propose"
            when={`Until ${formatIst(SCHEDULE.cfpClosesAt)}`}
          >
            <p>Anything you’re working on. {EVENT.slotMinutes} minutes, no slides required.</p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <a
                href={EVENT.links.submit}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-ink underline underline-offset-2"
              >
                Submit a proposal
              </a>
              <a
                href={EVENT.links.proposals}
                target="_blank"
                rel="noreferrer"
                className="text-ink-faint underline underline-offset-2 hover:text-ink"
              >
                See what’s in
              </a>
            </p>
          </Step>
          <Step
            index={2}
            title="Vote"
            when={`${formatIstDayTime(SCHEDULE.votingOpensAt)} → ${formatIst(SCHEDULE.votingClosesAt)}`}
          >
            <p>
              Pick up to {slots} talks. Change your mind as often as you like; only your
              last ballot counts.
            </p>
          </Step>
          <Step
            index={3}
            title="Watch"
            when={`Results ${formatIstDayTime(SCHEDULE.resultsAt)} · stage ${formatIstDayTime(SCHEDULE.stageStartsAt)}`}
          >
            <p>
              Results at {formatIstTime(SCHEDULE.resultsAt)}, then seven talks in{' '}
              {EVENT.hall} at {formatIstTime(SCHEDULE.stageStartsAt)}.
            </p>
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
              Yes, voting is for people in the room. You’ll need the ticket ID from your
              badge plus the email you claimed it with.
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
              until something worked. We check tickets once, later, when we count.
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
              mean linking proposals to tickets, which costs everyone their anonymity.
            </p>
          </details>
          <details className="faq-item">
            <summary>Is my vote anonymous?</summary>
            <p>
              Yes. Your details are hashed before anything is stored, and ballots only ever
              appear as totals.
            </p>
          </details>
        </div>
      </section>

      <footer className="border-t border-line pt-6 text-sm text-ink-faint">
        <p>
          {EVENT.name} is part of{' '}
          <a
            href={EVENT.links.indiafoss}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            {EVENT.conference}
          </a>
          , run by FOSS United. {EVENT.hall}, {EVENT.venue}, {EVENT.city}.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a
            href={EVENT.links.event}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            Event page
          </a>
          <a
            href={EVENT.links.proposals}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            All proposals
          </a>
          <a
            href={`mailto:${EVENT.contactEmail}`}
            className="underline underline-offset-2 hover:text-ink"
          >
            {EVENT.contactEmail}
          </a>
        </p>
      </footer>
    </div>
  )
}
