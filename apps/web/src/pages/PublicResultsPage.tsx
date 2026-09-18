import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api.js'
import { trackClasses } from '../lib/track-colors.js'
import { EVENT } from '../lib/event.js'

interface TalkResult {
  id: string
  title: string
  presenter_name?: string
  talk_type?: string | null
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
  // One vote per slot, so the vote budget is also the number of talks that fit.
  const slots = data?.method.votes_per_voter ?? EVENT.slotCount

  /**
   * Who is actually on stage, given there are only `slots` of them.
   *
   * Rank alone is not enough: a three-way tie at rank 6 puts eight talks at
   * "rank <= 7", and announcing eight winners for seven slots is a promise the
   * schedule cannot keep. A talk is confirmed only if everyone ahead of it
   * PLUS its whole tie group still fits. A tie straddling the cutoff is
   * reported as exactly what it is - undecided, pending the organisers'
   * tie-break.
   */
  const placing = (talk: TalkResult) => {
    const ahead = talks.filter((t) => t.vote_count > talk.vote_count).length
    const tied = talks.filter((t) => t.vote_count === talk.vote_count).length
    if (ahead + tied <= slots) return 'on-stage' as const
    if (ahead < slots) return 'tie-break' as const
    return 'out' as const
  }

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

        {talks.length === 0 ? (
          <div className="empty-state">
            <i className="ph-bold ph-trophy text-3xl opacity-50" aria-hidden="true" />
            <p className="text-lg font-bold text-ink">No results available yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {talks.map((talk, i) => {
              const rank = talk.rank ?? i + 1
              const place = placing(talk)
              const onStage = place === 'on-stage'
              const track = trackClasses(talk.talk_type)
              return (
                <div
                  key={talk.id}
                  className={[
                    'ui-card flex items-center gap-4 border-l-4 p-4',
                    track.border,
                    place === 'out' ? 'opacity-70' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold',
                      onStage ? 'bg-ink text-surface' : 'bg-ink/8 text-ink-faint',
                    ].join(' ')}
                  >
                    {rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {talk.talk_type && <span className={`tag ${track.tag}`}>{talk.talk_type}</span>}
                      {onStage && <span className="tag tag-ink">On stage</span>}
                      {place === 'tie-break' && (
                        <span className="tag tag-default">Tie, organisers deciding</span>
                      )}
                    </div>
                    <p className="truncate font-bold text-ink">{talk.title}</p>
                    {talk.presenter_name && <p className="truncate text-sm text-ink-faint">{talk.presenter_name}</p>}
                    {/* currentColor here tints the bar with the track's own
                        accent - decoration, so the vivid value is fine. */}
                    <div className={`progress mt-2 ${track.text}`}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(talk.vote_count / maxVotes) * 100}%`,
                          backgroundColor: 'currentColor',
                        }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="text-xl font-bold">{talk.vote_count}</span>
                    <span className="block text-xs text-ink-faint">votes</span>
                  </span>
                </div>
              )
            })}
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
