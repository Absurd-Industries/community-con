import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { formatDateTime, formatDuration } from '../lib/time.js'
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
        <p className="mt-2 text-sm leading-relaxed text-ink-light">{children}</p>
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

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-7 sm:p-9">
          <p className="eyebrow">IndiaFOSS 2026 · Bengaluru</p>
          <h1 className="page-title mt-3 max-w-xl">
            The lightning talk lineup, chosen by the room.
          </h1>
          <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ink-light">
            Anyone with a ticket can propose a flash talk on day one. Anyone with a ticket
            votes on day two. The talks with the most support go on stage after lunch — no
            programme committee, no back room.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/vote" className="btn-primary">
              {isOpen ? 'Vote now' : 'Open the ballot'}
            </Link>
            {conference?.results_public && (
              <Link to="/results" className="btn-outline">
                See the results
              </Link>
            )}
          </div>
        </div>

        <div className="card-ink flex flex-col justify-center p-7">
          <div>
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
          <dl className="mt-7 space-y-3 border-t border-white/15 pt-5 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-surface/60">Votes per ticket</dt>
              <dd className="font-mono font-semibold">{conference?.votes_per_voter ?? '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-surface/60">Voting closes</dt>
              <dd className="text-right font-mono text-xs">
                {formatDateTime(conference?.voting_closes_at ?? null) ?? '—'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="section-title mb-4">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          <Step index={1} title="Propose" when="Day one, until 4pm">
            Submit a five-minute talk on anything you're working on. Proposals close when the
            last session of day one starts.
          </Step>
          <Step index={2} title="Vote" when="Until noon on day two">
            Enter your ticket ID and pick your favourites — up to{' '}
            {conference?.votes_per_voter ?? 'a handful of'} of them. Change your mind as often
            as you like; the last ballot is the one that counts.
          </Step>
          <Step index={3} title="Watch" when="After lunch, day two">
            Results go up at lunch. The top talks take the stage an hour later.
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
              Yes. Voting is for people in the room. You'll be asked for the ticket ID on your
              badge — the same one in your ticket email.
            </p>
          </details>
          <details className="faq-item">
            <summary>Will it tell me if my ticket is valid?</summary>
            <p>
              No, and that's deliberate. If the form said "invalid ticket", anyone could sit
              outside and guess ticket numbers until one worked. Every ballot is accepted;
              tickets are checked once, later, when the votes are counted.
            </p>
          </details>
          <details className="faq-item">
            <summary>Can I vote more than once?</summary>
            <p>
              You can submit as many times as you like. Only the most recent ballot from each
              ticket is counted, so resubmitting replaces your previous picks rather than
              adding to them.
            </p>
          </details>
          <details className="faq-item">
            <summary>Can I vote for my own talk?</summary>
            <p>
              Nothing stops you. With one vote among hundreds it doesn't move the needle, and
              the alternative — linking proposals to tickets — would cost everyone their
              anonymity for no real gain.
            </p>
          </details>
          <details className="faq-item">
            <summary>Is my vote anonymous?</summary>
            <p>
              Your ticket ID is hashed in your browser before anything is stored, and ballots
              are never shown per-person — only as totals.
            </p>
          </details>
        </div>
      </section>

      <footer className="border-t border-line pt-6 text-sm text-ink-faint">
        <p>Community Con is part of IndiaFOSS 2026, run by FOSS United.</p>
      </footer>
    </div>
  )
}
