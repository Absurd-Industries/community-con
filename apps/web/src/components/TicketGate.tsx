import { useState, type FormEvent } from 'react'

interface Props {
  onSubmit: (ticket: string) => Promise<unknown>
}

/**
 * The only thing standing between a visitor and the ballot.
 *
 * It deliberately does not check anything beyond "you typed something". Telling
 * someone their ticket is invalid would let anyone enumerate valid ticket IDs
 * from this form, so validity is decided later, at tally time, where nobody is
 * watching the response.
 */
export default function TicketGate({ onSubmit }: Props) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!value.trim() || busy) return
    setBusy(true)
    try {
      await onSubmit(value)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-12">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">Community Con</p>
        <h1 className="page-title mt-2">Enter your ticket ID</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-light">
          It's printed on your IndiaFOSS badge and in your ticket email.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label htmlFor="ticket" className="ui-label">
            Ticket ID
          </label>
          <input
            id="ticket"
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder="IF26-0000"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="ui-input font-mono tracking-wide"
          />
          <button type="submit" disabled={!value.trim() || busy} className="btn-primary mt-4 w-full">
            {busy ? 'One moment…' : 'Continue to the ballot'}
          </button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
          We don't check your ticket now, and this page will never tell you whether it's valid.
          Ballots are matched against the ticket list when results are tallied — so there's
          nothing to learn by guessing.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Your ticket ID is hashed in your browser. Only the hash is stored.
        </p>
      </div>
    </div>
  )
}
