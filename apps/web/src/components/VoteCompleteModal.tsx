import { useEffect } from 'react'
import { formatDateTime } from '../lib/time.js'
import VoterHash from './VoterHash.js'

/**
 * Confirmation after a ballot is submitted.
 *
 * The old version counted down and redirected home. It no longer does: a voter
 * who wants to change their picks should not have to race a timer to do it.
 */
export default function VoteCompleteModal({
  votesTotal,
  castAt,
  deadline,
  voterHash,
  onClose,
}: {
  votesTotal: number
  /** When this ballot was recorded. Every ballot is stamped; show it. */
  castAt: number | null
  deadline: string | null
  /** Shown as a receipt: the ID this ballot was filed under. */
  voterHash: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const stamped = formatDateTime(castAt)

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Ballot submitted"
      onClick={onClose}
    >
      <div className="modal-panel !max-w-md" onClick={event => event.stopPropagation()}>
        <div className="px-7 py-8 text-center">
          <i className="ph-fill ph-check-circle text-5xl text-positive" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-bold text-ink">Ballot submitted</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-light">
            {votesTotal} {votesTotal === 1 ? 'talk' : 'talks'} recorded. Thank you!
          </p>
          {stamped && (
            <p className="mt-1 font-mono text-xs text-ink-faint">Timestamped {stamped}</p>
          )}
          <p className="mt-4 rounded-control border border-line bg-surface-sunken px-4 py-3 text-sm text-ink">
            Changed your mind? Submit again {deadline ? `before ${deadline}` : 'before voting closes'}.
            Only your last ballot counts.
          </p>

          {/* The receipt. Someone who notes this down can find their own ballot
              in the published log afterwards and check it was counted. */}
          <div className="mt-4">
            <VoterHash hash={voterHash} />
          </div>

          <button onClick={onClose} className="btn-primary mt-6 w-full">
            Back to the ballot
          </button>
        </div>
      </div>
    </div>
  )
}
