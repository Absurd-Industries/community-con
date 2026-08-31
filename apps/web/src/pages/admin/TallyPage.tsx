import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { sha256Hex } from '../../lib/hash.js'
import { getStore, mutate, tally, type DemoStore, type TallySummary } from '../../mock/store.js'
import { DEMO_VALID_TICKETS } from '../../mock/seed.js'
import { formatDateTime } from '../../lib/time.js'

/**
 * The tally.
 *
 * Ballots are accepted from anyone, so nothing is decided until this page runs.
 * Paste the official ticket list, and it: hashes each ID, drops ballots whose
 * ticket is not on the list, keeps only the latest ballot from each remaining
 * ticket, and counts what's left.
 *
 * This is a preview of the mechanic, not the production tally - the real one
 * runs server-side against the ballot table. The rule it implements lives in
 * src/mock/store.ts `tally`, shared with the live results so the two can't drift.
 */

interface Row {
  id: string
  title: string
  presenter_name: string
  vote_count: number
  rank: number
}

export default function TallyPage() {
  const qc = useQueryClient()
  const [store, setStore] = useState<DemoStore | null>(null)
  const [raw, setRaw] = useState('')
  const [applied, setApplied] = useState<Set<string> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getStore().then(setStore)
  }, [])

  const parsedTickets = useMemo(
    () =>
      [...new Set(raw.split(/[\s,;]+/).map(t => t.trim().toUpperCase()).filter(Boolean))],
    [raw]
  )

  async function runTally() {
    if (!store) return
    setBusy(true)
    try {
      const hashes = await Promise.all(parsedTickets.map(sha256Hex))
      setApplied(new Set(hashes))
    } finally {
      setBusy(false)
    }
  }

  // Runs the shared rule against a hypothetical ticket list without touching
  // the stored data - so an organiser can try a list before committing to it.
  const result = useMemo(() => {
    if (!store) return null
    const candidate: DemoStore = applied
      ? { ...store, valid_ticket_hashes: [...applied] }
      : store
    const { ballots, summary } = tally(candidate)

    const counts = new Map<string, number>(store.talks.map(t => [t.id, 0]))
    for (const ballot of ballots) {
      for (const talkId of ballot.talk_ids) {
        if (counts.has(talkId)) counts.set(talkId, (counts.get(talkId) ?? 0) + 1)
      }
    }

    const sorted = store.talks
      .filter(talk => talk.withdrawn_at === null)
      .map(talk => ({
        id: talk.id,
        title: talk.title,
        presenter_name: talk.presenter_name,
        vote_count: counts.get(talk.id) ?? 0,
      }))
      .sort((a, b) => b.vote_count - a.vote_count || a.title.localeCompare(b.title))

    let previousVotes: number | undefined
    let previousRank = 0
    const rows: Row[] = sorted.map((talk, index) => {
      const rank = talk.vote_count === previousVotes ? previousRank : index + 1
      previousVotes = talk.vote_count
      previousRank = rank
      return { ...talk, rank }
    })

    return { rows, summary, slots: store.conference.votes_per_voter }
  }, [store, applied])

  async function commit() {
    if (!applied) return
    await mutate(current => {
      current.valid_ticket_hashes = [...applied]
    })
    // Live results read the same rule, so everything that shows vote counts
    // needs to re-read once the official list is in place.
    qc.invalidateQueries()
    setStore(await getStore())
  }

  if (!store || !result) {
    return <div className="skeleton h-64 w-full" />
  }

  const { summary, rows, slots } = result
  const committed = store.valid_ticket_hashes.length > 0

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Organiser</p>
        <h1 className="page-title mt-2">Tally</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-light">
          Ballots were accepted without checking anyone's ticket. This is where that gets
          resolved: paste the official ticket list, and only the latest ballot from each
          listed ticket is counted.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* Ticket list input */}
        <div className="card p-5">
          <label htmlFor="tickets" className="ui-label">
            Official ticket IDs
          </label>
          <textarea
            id="tickets"
            value={raw}
            onChange={event => setRaw(event.target.value)}
            rows={9}
            placeholder={'IF26-4821\nIF26-1170\nIF26-9034'}
            className="ui-input resize-y font-mono text-xs"
          />
          <p className="mt-2 text-xs text-ink-faint">
            One per line, or separated by commas or spaces.{' '}
            {parsedTickets.length > 0 && (
              <span className="text-ink">{parsedTickets.length} unique.</span>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={runTally} disabled={busy || parsedTickets.length === 0} className="btn-primary btn-sm">
              {busy ? 'Hashing…' : 'Run tally'}
            </button>
            <button
              onClick={() => setRaw(DEMO_VALID_TICKETS.join('\n'))}
              className="btn-outline btn-sm"
            >
              Load sample list
            </button>
            {applied && (
              <button onClick={() => { setApplied(null); setRaw('') }} className="btn-ghost btn-sm">
                Clear
              </button>
            )}
          </div>
          {applied && !committed && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs leading-relaxed text-ink-faint">
                This is a preview. Committing makes the same list apply to the live results
                page too.
              </p>
              <button onClick={commit} className="btn-outline btn-sm mt-2">
                Commit this ticket list
              </button>
            </div>
          )}
        </div>

        {/* What the tally discarded */}
        <div className="card-ink p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-surface/60">
            {applied ? 'With this ticket list' : 'No ticket list applied'}
          </p>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums">
            {summary.counted}
          </p>
          <p className="text-sm text-surface/70">ballots counted</p>

          <dl className="mt-6 space-y-2.5 border-t border-white/15 pt-5 text-sm">
            <Line label="Ballots submitted" value={summary.ballots_cast} />
            <Line label="From tickets not on the list" value={summary.from_unknown_tickets} muted />
            <Line label="Superseded by a later ballot" value={summary.superseded} muted />
            <Line
              label="Ticket-holders who didn't vote"
              value={
                summary.eligible_tickets === null
                  ? '—'
                  : Math.max(0, summary.eligible_tickets - summary.counted)
              }
              muted
            />
          </dl>
          {!applied && (
            <p className="mt-5 text-xs leading-relaxed text-surface/60">
              Every ballot is being counted, including ones cast with tickets that may not
              exist. Paste the official list to see the difference.
            </p>
          )}
        </div>
      </div>

      {/* Ranked outcome */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="section-title">Ranked result</h2>
          <p className="text-xs text-ink-faint">
            Top {slots} take the stage. A shared rank is a genuine tie — break it on the
            Results page.
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">#</th>
              <th>Talk</th>
              <th className="w-40">Speaker</th>
              <th className="w-20 text-right">Votes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className={row.rank <= slots ? '' : 'text-ink-faint'}>
                <td className="font-mono tabular-nums">{row.rank}</td>
                <td>
                  <span className={row.rank <= slots ? 'font-semibold text-ink' : ''}>
                    {row.title}
                  </span>
                  {row.rank <= slots && <span className="tag tag-funded ml-2">Selected</span>}
                </td>
                <td className="text-ink-faint">{row.presenter_name}</td>
                <td className="text-right font-mono tabular-nums">{row.vote_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-faint">
        Latest ballot in the log: {formatDateTime(
          store.ballots.reduce((latest, b) => Math.max(latest, b.cast_at), 0) || null
        ) ?? '—'}
      </p>
    </div>
  )
}

function Line({ label, value, muted }: { label: string; value: number | string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? 'text-surface/55' : 'text-surface/75'}>{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  )
}

export type { TallySummary }
