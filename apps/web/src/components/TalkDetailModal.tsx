import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import ReferenceEmbeds, { type Reference } from './ReferenceEmbeds.js'

export interface TalkDetail {
  id: string
  title: string
  description: string | null
  presenter_name?: string
  presenter_bio?: string | null
  talk_type?: string | null
  cfp_url?: string | null
  cfp_content?: string | null
  references?: string | null
  withdrawn_at?: number | null
  withdrawal_reason?: string | null
}

function parseReferences(raw: string | null | undefined): Reference[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((r) => r && typeof r.url === 'string')
    }
  } catch {
    /* not JSON - ignore */
  }
  return []
}

export default function TalkDetailModal({
  talk,
  onClose,
}: {
  talk: TalkDetail
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const body = talk.cfp_content?.trim() || talk.description?.trim() || ''
  const references = parseReferences(talk.references)

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={talk.title}
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 rounded-t-2xl border-b border-ink/10 bg-surface-sunken px-6 py-5">
          <div className="min-w-0">
            {talk.talk_type && <span className="tag tag-muted mb-2">{talk.talk_type}</span>}
            <h2 className="text-2xl font-bold leading-tight text-ink">{talk.title}</h2>
            {talk.presenter_name && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-faint">
                <i className="ph-bold ph-user" aria-hidden="true" />
                {talk.presenter_name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost shrink-0 !p-2 text-lg"
          >
            <i className="ph-bold ph-x" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[62vh] min-w-0 overflow-x-hidden overflow-y-auto px-6 py-6">
          {body ? (
            <div className="ui-prose">
              <ReactMarkdown>{body}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">No further details were provided for this submission.</p>
          )}

          {talk.presenter_bio && !talk.cfp_content && (
            <div className="mt-6 border-t border-dashed border-ink/20 pt-4">
              <p className="supertitle mb-1">About the speaker</p>
              <p className="text-sm leading-6 text-ink-light">{talk.presenter_bio}</p>
            </div>
          )}

          {references.length > 0 && (
            <div className="mt-7 border-t border-ink/10 pt-5">
              <p className="supertitle mb-3 flex items-center gap-1.5">
                <i className="ph-bold ph-link-simple" aria-hidden="true" /> References &amp; Links
              </p>
              <ReferenceEmbeds references={references} />
            </div>
          )}
        </div>

        {/* Footer */}
        {talk.cfp_url && (
          <div className="flex justify-end rounded-b-2xl border-t border-ink/10 bg-surface-sunken px-6 py-4">
            <a href={talk.cfp_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
              <i className="ph-bold ph-arrow-square-out" aria-hidden="true" /> View on FOSS United
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
