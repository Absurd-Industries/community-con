import { useState, type FormEvent } from 'react'
import { looksLikeEmail } from '../lib/hash.js'
import { EVENT } from '../lib/event.js'

interface Props {
  onSubmit: (ticket: string, email: string) => Promise<unknown>
}

/**
 * The only thing standing between a visitor and the ballot.
 *
 * It deliberately does not check anything beyond "you typed something in both
 * boxes, and the second one is shaped like an email". Telling someone their
 * ticket is invalid would let anyone enumerate valid tickets from this form, so
 * validity is decided later, at tally time, where nobody is watching the
 * response.
 *
 * The email shape check is safe precisely because it looks only at the string
 * in front of it. It catches a voter's own typo and reveals nothing about
 * whether the pair exists. Do not "improve" it into a real lookup.
 */
export default function TicketGate({ onSubmit }: Props) {
  const [ticket, setTicket] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const filled = ticket.trim().length > 0 && email.trim().length > 0

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!filled || busy) return
    if (!looksLikeEmail(email)) {
      setError('That doesn’t look like an email address. Check for a typo?')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit(ticket, email)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-12">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">{EVENT.name}</p>
        <h1 className="page-title mt-2">Let’s find your ballot</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-light">
          Two quick things and you’re in.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="ticket" className="ui-label">
              Ticket ID
            </label>
            <input
              id="ticket"
              value={ticket}
              onChange={event => {
                setTicket(event.target.value)
                setError(null)
              }}
              placeholder="IF26-0000"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="ui-input font-mono tracking-wide"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              It’s on your {EVENT.conference} badge.
            </p>
          </div>

          <div>
            <label htmlFor="email" className="ui-label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={event => {
                setEmail(event.target.value)
                setError(null)
              }}
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              className="ui-input"
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              The one you claimed your ticket with.
            </p>
          </div>

          {error && (
            <div className="status-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={!filled || busy} className="btn-primary w-full">
            {busy ? 'One moment…' : 'Continue to the ballot'}
          </button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
          Both get hashed in your browser. We store the hash and nothing else, so we never
          see your ticket or your email.
        </p>
      </div>
    </div>
  )
}
