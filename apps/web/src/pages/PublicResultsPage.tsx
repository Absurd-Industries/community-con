import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'

interface TalkResult {
  id: string
  title: string
  presenter_name?: string
  vote_count: number
  rank: number
}

interface PublicResultsResponse {
  conference: { name: string; description: string | null }
  talks: TalkResult[]
  stats: { eligible_voters: number; participating_voters: number; total_votes: number }
  method: { type: 'approval'; votes_per_voter: number; notes: string }
}

export default function PublicResultsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-results'],
    queryFn: () => apiFetch<PublicResultsResponse>('/api/results'),
    retry: false,
  })

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-ink-faint">Loading results…</div>
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="ui-card p-10 text-center">
          <i className="ph-bold ph-eye-slash mb-2 text-4xl text-ink-faint" aria-hidden="true" />
          <h1 className="page-title">Results are not public yet</h1>
          <p className="mt-2 text-sm text-ink-light">
            Check back after the organizers publish the final results.
          </p>
          <Link to="/" className="btn btn-outline mt-6">
            <i className="ph-bold ph-arrow-left" aria-hidden="true" /> Back to home
          </Link>
        </div>
      </div>
    )
  }

  const talks = data?.talks ?? []
  const maxVotes = Math.max(1, ...talks.map((t) => t.vote_count))

  return (
    <div className="min-h-screen text-ink">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="ui-card mb-6 p-6">
          <p className="supertitle mb-1">Public results</p>
          <h1 className="page-title">{data?.conference.name}</h1>
          {data?.conference.description && (
            <p className="mt-2 text-sm leading-relaxed text-ink-light">{data.conference.description}</p>
          )}
        </div>

        {data && (
          <div className="card-grid mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Participating voters', value: data.stats.participating_voters },
              { label: 'Total votes', value: data.stats.total_votes },
              { label: 'Votes per voter', value: data.method.votes_per_voter },
            ].map((s) => (
              <div key={s.label} className="ui-card p-5">
                <p className="eyebrow">{s.label}</p>
                <p className="mt-1.5 text-3xl font-bold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {talks.length === 0 ? (
          <div className="empty-state">
            <i className="ph-bold ph-trophy text-3xl opacity-50" aria-hidden="true" />
            <p className="text-lg font-bold text-ink">No results available yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {talks.map((talk, i) => (
              <div key={talk.id} className="ui-card flex items-center gap-4 p-4">
                <span
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold',
                    i === 0 ? 'bg-ink text-surface' : 'bg-ink/8 text-ink-faint',
                  ].join(' ')}
                >
                  {talk.rank ?? i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{talk.title}</p>
                  {talk.presenter_name && <p className="truncate text-sm text-ink-faint">{talk.presenter_name}</p>}
                  <div className="progress mt-2">
                    <div className="progress-fill" style={{ width: `${(talk.vote_count / maxVotes) * 100}%` }} />
                  </div>
                </div>
                <span className="shrink-0 text-right">
                  <span className="text-xl font-bold">{talk.vote_count}</span>
                  <span className="block text-xs text-ink-faint">votes</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {data && (
          <div className="ui-card mt-6 p-5 text-sm text-ink-light">
            <p className="section-title mb-1">How voting worked</p>
            <p className="mt-1 leading-relaxed">{data.method.notes}</p>
          </div>
        )}
      </main>
    </div>
  )
}
