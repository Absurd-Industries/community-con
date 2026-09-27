import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { EVENT } from '../lib/event.js'
import ResultsList, { type PublicResultsResponse } from '../components/ResultsList.js'

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
  // One vote per slot, so the vote budget is also the number of talks that fit.
  const slots = data?.method.votes_per_voter ?? EVENT.slotCount

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
              { label: 'Slots on stage', value: data.method.votes_per_voter },
            ].map((s) => (
              <div key={s.label} className="ui-card p-5">
                <p className="eyebrow">{s.label}</p>
                <p className="mt-1.5 text-3xl font-bold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <ResultsList talks={talks} slots={slots} />

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
