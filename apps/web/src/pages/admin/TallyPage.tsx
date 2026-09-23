import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Placing, TallySummary } from '@cc/db'
import { apiFetch } from '../../lib/api.js'
import { hashPairs } from '../../lib/hash.js'
import { parseVoterList } from '../../lib/voter-list.js'
import { formatDateTime } from '../../lib/time.js'

/**
 * The tally.
 *
 * Ballots were accepted from anyone, so nothing is decided until this page
 * runs. Paste the official list of claimed tickets - `ticket_id,email` per
 * line - and the browser hashes each pair exactly the way the vote page did.
 * Only the hashes are sent. The server then drops ballots whose hash is not on
 * the list, keeps the latest ballot from each remaining voter, and counts what
 * is left.
 *
 * The counting rule itself lives in @cc/db `tallyBallots`, shared with the
 * Worker, so this preview and the real count cannot drift apart.
 */

interface Row {
  id: string
  title: string
  presenter_name: string
  vote_count: number
  rank: number
  placing: Placing
}

interface PreviewResponse {
  summary: TallySummary
  malformed: number
  slots: number
  rows: Row[]
  latest_ballot_at: number | null
}

export default function TallyPage() {
  const qc = useQueryClient()
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [appliedHashes, setAppliedHashes] = useState<string[] | null>(null)

  const parsed = useMemo(() => parseVoterList(raw), [raw])

  // What the live results are currently counting against.
  const committed = useQuery({
    queryKey: ['admin-voters'],
    queryFn: () => apiFetch<{ count: number; uploaded_at: number | null }>('/api/admin/voters'),
  })

  // With no list pasted, this shows the count as it stands right now: every
  // ballot, including ones from tickets that may not exist.
  const live = useQuery({
    queryKey: ['admin-tally-live'],
    queryFn: () =>
      apiFetch<PreviewResponse>('/api/admin/voters/preview', {
        method: 'POST',
        body: JSON.stringify({ voter_hashes: [] }),
      }),
  })

  const runTally = useMutation({
    mutationFn: async () => {
      const hashes = await hashPairs(parsed.pairs)
      const result = await apiFetch<PreviewResponse>('/api/admin/voters/preview', {
        method: 'POST',
        body: JSON.stringify({ voter_hashes: hashes }),
      })
      return { hashes, result }
    },
    onSuccess: ({ hashes, result }) => {
      setAppliedHashes(hashes)
      setPreview(result)
    },
  })

  const commit = useMutation({
    mutationFn: () =>
      apiFetch('/api/admin/voters', {
        method: 'PUT',
        body: JSON.stringify({ voter_hashes: appliedHashes ?? [] }),
      }),
    // Everything that shows a vote count now counts against this list.
    onSuccess: () => qc.invalidateQueries(),
  })

  const shown = preview ?? live.data

  if (!shown) return <div className="skeleton h-64 w-full" />

  const { summary, rows, slots } = shown
  const contested = rows.filter(row => row.placing === 'tie-break').length
  const isPreview = preview !== null
  const hasCommittedList = (committed.data?.count ?? 0) > 0

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Organiser</p>
        <h1 className="page-title mt-2">Tally</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-light">
          Ballots were accepted without checking anyone's ticket. This is where that gets
          resolved: paste the official list of claimed tickets, and only the latest ballot
          from each listed pair is counted. The tickets and emails are hashed in this browser
          and never sent.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="card p-5">
          <label htmlFor="tickets" className="ui-label">
            Official list of claimed tickets
          </label>
          <textarea
            id="tickets"
            value={raw}
            onChange={event => setRaw(event.target.value)}
            rows={9}
            placeholder={'ticket_id,email\nxxxxxx,someone@example.com'}
            className="ui-input resize-y font-mono text-xs"
          />
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            One <code className="font-mono">ticket_id,email</code> per line. A header row is
            fine.{' '}
            {parsed.pairs.length > 0 && (
              <span className="text-ink">{parsed.pairs.length} pairs.</span>
            )}{' '}
            {parsed.duplicates > 0 && <span>{parsed.duplicates} duplicate. </span>}
            {parsed.skipped.length > 0 && (
              <span className="text-danger">
                {parsed.skipped.length} line{parsed.skipped.length === 1 ? '' : 's'} skipped
                (line{parsed.skipped.length === 1 ? '' : 's'}{' '}
                {parsed.skipped.slice(0, 5).join(', ')}
                {parsed.skipped.length > 5 ? '…' : ''}).
              </span>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => runTally.mutate()}
              disabled={runTally.isPending || parsed.pairs.length === 0}
              className="btn-primary btn-sm"
            >
              {runTally.isPending ? 'Hashing…' : 'Run tally'}
            </button>
            {isPreview && (
              <button
                onClick={() => {
                  setPreview(null)
                  setAppliedHashes(null)
                  setRaw('')
                }}
                className="btn-ghost btn-sm"
              >
                Clear
              </button>
            )}
          </div>

          {runTally.isError && (
            <p className="mt-3 text-sm text-danger">{(runTally.error as Error).message}</p>
          )}

          {isPreview && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs leading-relaxed text-ink-faint">
                This is a preview - nothing is saved yet. Committing makes the same list apply
                to the live results page too.
              </p>
              <button
                onClick={() => commit.mutate()}
                disabled={commit.isPending}
                className="btn-outline btn-sm mt-2"
              >
                {commit.isPending ? 'Saving…' : 'Commit this ticket list'}
              </button>
              {commit.isError && (
                <p className="mt-2 text-sm text-danger">{(commit.error as Error).message}</p>
              )}
              {commit.isSuccess && (
                <p className="mt-2 text-sm text-ink-faint">Saved. The results now use this list.</p>
              )}
            </div>
          )}

          {hasCommittedList && (
            <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
              A list of {committed.data?.count} claimed tickets is currently in force, loaded{' '}
              {formatDateTime(committed.data?.uploaded_at ?? null) ?? 'earlier'}.
            </p>
          )}
        </div>

        <div className="card-ink p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-surface/60">
            {isPreview ? 'With this ticket list' : 'No ticket list applied'}
          </p>
          <p className="mt-2 font-mono text-4xl font-semibold tabular-nums">{summary.counted}</p>
          <p className="text-sm text-surface/70">ballots counted</p>

          <dl className="mt-6 space-y-2.5 border-t border-white/15 pt-5 text-sm">
            <Line label="Ballots submitted" value={summary.ballots_cast} />
            <Line label="From pairs not on the list" value={summary.from_unknown_tickets} muted />
            <Line label="Superseded by a later ballot" value={summary.superseded} muted />
            <Line
              label="Ticket-holders who didn't vote"
              value={
                summary.eligible_tickets === null
                  ? 'n/a'
                  : Math.max(0, summary.eligible_tickets - summary.counted)
              }
              muted
            />
          </dl>
          {!isPreview && (
            <p className="mt-5 text-xs leading-relaxed text-surface/60">
              Every ballot is being counted, including ones cast with tickets and emails that
              may not exist. Paste the official list to see the difference.
            </p>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="section-title">Ranked result</h2>
          <p className="text-xs text-ink-faint">
            Top {slots} take the stage.{' '}
            {contested > 0 ? (
              <span className="text-danger">
                {contested} talks are tied across the cutoff. Break it on the Results page.
              </span>
            ) : (
              'A shared rank is a genuine tie. Break it on the Results page.'
            )}
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
              <tr key={row.id} className={row.placing === 'out' ? 'text-ink-faint' : ''}>
                <td className="font-mono tabular-nums">{row.rank}</td>
                <td>
                  <span className={row.placing === 'selected' ? 'font-semibold text-ink' : ''}>
                    {row.title}
                  </span>
                  {row.placing === 'selected' && (
                    <span className="tag tag-funded ml-2">Selected</span>
                  )}
                  {row.placing === 'tie-break' && (
                    <span className="tag tag-default ml-2">Tie-break needed</span>
                  )}
                </td>
                <td className="text-ink-faint">{row.presenter_name}</td>
                <td className="text-right font-mono tabular-nums">{row.vote_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-faint">
        Latest ballot in the log: {formatDateTime(shown.latest_ballot_at) ?? 'none yet'}
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
