import { useEffect } from 'react'

/**
 * Confirmation after a ballot is submitted.
 *
 * The old version counted down and redirected home. It no longer does: a voter
 * who wants to change their picks should not have to race a timer to do it.
 */
export default function VoteCompleteModal({
  votesTotal,
  deadline,
  onClose,
}: {
  votesTotal: number
  deadline: string | null
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
            {votesTotal} {votesTotal === 1 ? 'talk' : 'talks'} recorded against your ticket.
          </p>
          <p className="mt-4 rounded-control border border-line bg-surface-sunken px-4 py-3 text-sm text-ink">
            Change your mind {deadline ? `before ${deadline}` : 'before voting closes'} and just
            submit again — only your last ballot is counted.
          </p>

          <button onClick={onClose} className="btn-primary mt-6 w-full">
            Back to the ballot
          </button>
        </div>
      </div>
    </div>
  )
}
