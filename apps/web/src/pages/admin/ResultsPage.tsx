import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'
import { formatDateTime, formatDuration } from '../../lib/time.js'

interface TalkResult {
  id: string
  title: string
  presenter_name: string
  vote_count: number
  rank: number
}

interface ResultsResponse {
  talks: TalkResult[]
  results_public: boolean
  stats: {
    eligible_voters: number
    participating_voters: number
    total_votes: number
  }
  method: {
    type: 'approval'
    votes_per_voter: number
    notes: string
  }
  tie_breaks: Array<{
    id: string
    selected_talk_id: string
    tied_talk_ids: string[]
    reason: string
    admin_email: string | null
  }>
}

interface Conference {
  voting_status: 'open' | 'closed'
  voting_opens_at: number | null
  voting_closes_at: number | null
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

export default function ResultsPage() {
  const qc = useQueryClient()
  const now = useNow()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-results'],
    queryFn: () => apiFetch<ResultsResponse>('/api/admin/results'),
    refetchInterval: 30_000,
  })

  const { data: conference } = useQuery({
    queryKey: ['conference'],
    queryFn: () => apiFetch<Conference>('/api/conference'),
  })

  const handleExport = async () => {
    const blob = await apiFetch<Blob>('/api/admin/results/export')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const publishResults = useMutation({
    mutationFn: (resultsPublic: boolean) =>
      apiFetch('/api/admin/results/publication', {
        method: 'PUT',
        body: JSON.stringify({ results_public: resultsPublic }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-results'] })
      qc.invalidateQueries({ queryKey: ['admin-audit'] })
    },
  })

  const recordTieBreak = useMutation({
    mutationFn: (payload: { selected_talk_id: string; tied_talk_ids: string[]; reason: string }) =>
      apiFetch('/api/admin/results/tie-breaks', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-results'] }),
  })

  if (isLoading) return <div className="text-sm uppercase tracking-wide text-ink-faint">Loading…</div>

  const talks = data?.talks ?? []
  const totalVotes = data?.stats.total_votes ?? talks.reduce((sum, t) => sum + t.vote_count, 0)
  const isOpen = conference?.voting_status === 'open'
  const tieGroups = Object.values(talks.reduce<Record<string, TalkResult[]>>((groups, talk) => {
    const key = String(talk.vote_count)
    ;(groups[key] ??= []).push(talk)
    return groups
  }, {})).filter(group => group.length > 1)
  const boundary = isOpen ? conference?.voting_closes_at : conference?.voting_opens_at
  const offset = conference ? conference.server_now - Date.now() : 0
  const effectiveNow = now + offset
  const showCountdown = boundary !== null && boundary !== undefined && boundary > effectiveNow

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Organiser</p>
          <h1 className="page-title">Results</h1>
          <p className="text-sm text-ink-faint">{totalVotes} total votes cast</p>
        </div>
        <button onClick={handleExport} className="btn-ink">Export CSV</button>
      </div>

      <div className="ui-card p-4 text-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-title">
              Public results are {data?.results_public ? 'visible' : 'hidden'}.
            </p>
            <p className="mt-1 text-ink-faint">
              Publish when admins are ready for voters to see the ranked results page.
            </p>
          </div>
          <button
            onClick={() => publishResults.mutate(!(data?.results_public ?? false))}
            disabled={publishResults.isPending}
            className="btn-label"
          >
            {data?.results_public ? 'Hide Public Results' : 'Publish Results'}
          </button>
        </div>
        {data?.results_public && (
          <a href="/results" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink transition-colors hover:text-black">
            View public results
          </a>
        )}
      </div>

      {conference && (
        <div className="ui-card p-4 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className={isOpen ? 'font-bold uppercase text-positive' : 'font-bold uppercase text-ink-faint'}>
              {isOpen ? 'Voting is open; results may change.' : 'Voting is closed.'}
            </span>
            {showCountdown && (
              <span className="text-ink-light">
                {isOpen ? 'Closes in' : 'Opens in'} {formatDuration(boundary! - effectiveNow)}
              </span>
            )}
          </div>
          {conference.voting_closes_at && (
            <p className="mt-1 text-ink-faint">Scheduled close: {formatDateTime(conference.voting_closes_at)}</p>
          )}
        </div>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Participating voters', value: data.stats.participating_voters },
            { label: 'Total votes', value: data.stats.total_votes },
            { label: 'Votes per voter', value: data.method.votes_per_voter },
          ].map(stat => (
            <div key={stat.label} className="ui-card p-4">
              <p className="supertitle">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-ink">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="ui-card p-4 text-sm text-ink-light">
          <p className="section-title">Method</p>
          <p className="mt-1 leading-relaxed">{data.method.notes}</p>
        </div>
      )}

      {talks.length === 0 && (
        <div className="empty-state">No talks or votes yet.</div>
      )}

      {talks.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Talk</th>
              <th>Presenter</th>
              <th className="!text-right">Votes</th>
            </tr>
          </thead>
          <tbody>
            {talks.map((talk, i) => (
              <tr key={talk.id}>
                <td className="text-ink-faint">{talk.rank ?? i + 1}</td>
                <td className="font-medium text-ink">{talk.title}</td>
                <td className="text-ink-light">{talk.presenter_name}</td>
                <td className="text-right font-bold text-ink">{talk.vote_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tieGroups.length > 0 && (
        <div className="ui-card space-y-4 p-5">
          <div>
            <h2 className="section-title">Organizer Tie-breaks</h2>
            <p className="mt-1 text-sm text-ink-faint">Community totals stay unchanged. Record a separate scheduling decision after voting closes.</p>
          </div>
          {tieGroups.map(group => (
            <div key={group[0].vote_count} className="border-t border-ink/10 pt-3">
              <p className="text-sm font-bold">{group[0].vote_count} votes each</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.map(talk => (
                  <button key={talk.id} className="btn-label btn-sm" disabled={isOpen || recordTieBreak.isPending}
                    onClick={() => {
                      const reason = window.prompt(`Why should "${talk.title}" win this organizer tie-break?`)
                      if (reason?.trim()) recordTieBreak.mutate({
                        selected_talk_id: talk.id,
                        tied_talk_ids: group.map(item => item.id),
                        reason: reason.trim(),
                      })
                    }}>Choose {talk.title}</button>
                ))}
              </div>
            </div>
          ))}
          {(data?.tie_breaks ?? []).map(decision => (
            <p key={decision.id} className="text-xs text-ink-faint">
              Selected {talks.find(talk => talk.id === decision.selected_talk_id)?.title ?? decision.selected_talk_id}: {decision.reason}
              {decision.admin_email ? ` — ${decision.admin_email}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
