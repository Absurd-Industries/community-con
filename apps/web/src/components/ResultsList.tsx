import { trackClasses } from '../lib/track-colors.js'

export interface TalkResult {
  id: string
  title: string
  presenter_name?: string
  talk_type?: string | null
  vote_count: number
  rank: number
}

export interface PublicResultsResponse {
  conference: { name: string; description: string | null }
  talks: TalkResult[]
  stats: { eligible_voters: number; participating_voters: number; total_votes: number }
  method: { type: 'approval'; votes_per_voter: number; notes: string }
}

/**
 * The ranked results, shared by the homepage and /results.
 *
 * Who is on stage is decided here, not by rank alone: a three-way tie at rank
 * 6 puts eight talks at "rank <= 7", and announcing eight winners for seven
 * slots is a promise the schedule cannot keep. A talk is confirmed only if
 * everyone ahead of it PLUS its whole tie group still fits. A tie straddling
 * the cutoff is reported as exactly what it is: undecided, pending the
 * organisers' tie-break.
 */
export default function ResultsList({ talks, slots }: { talks: TalkResult[]; slots: number }) {
  if (talks.length === 0) {
    return (
      <div className="empty-state">
        <i className="ph-bold ph-trophy text-3xl opacity-50" aria-hidden="true" />
        <p className="text-lg font-bold text-ink">No results available yet</p>
      </div>
    )
  }

  const maxVotes = Math.max(1, ...talks.map(t => t.vote_count))

  const placing = (talk: TalkResult) => {
    const ahead = talks.filter(t => t.vote_count > talk.vote_count).length
    const tied = talks.filter(t => t.vote_count === talk.vote_count).length
    if (ahead + tied <= slots) return 'on-stage' as const
    if (ahead < slots) return 'tie-break' as const
    return 'out' as const
  }

  return (
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
              {talk.presenter_name && (
                <p className="truncate text-sm text-ink-faint">{talk.presenter_name}</p>
              )}
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
  )
}
