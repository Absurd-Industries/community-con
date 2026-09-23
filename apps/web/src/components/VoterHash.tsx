import { useState } from 'react'

/**
 * The voter's own hash, shown to them in full.
 *
 * This is the number their ballot is filed under, and it is the only thing the
 * server ever receives about them. Showing it is what makes the anonymity
 * claim checkable rather than a promise: anyone can recompute it from their own
 * ticket and email, in any language, and confirm the site is not quietly
 * sending something else.
 *
 *     python3 -c "import hashlib; print(hashlib.sha256(b'TICKET+email').hexdigest())"
 *
 * It is not a secret. Knowing someone's hash does not let you vote as them -
 * ballots are accepted from any hash, and only the official ticket list decides
 * which ones count. But it is linkable to them if they published it, so the
 * copy button is offered and nothing is auto-shared.
 */
export default function VoterHash({
  hash,
  tone = 'light',
}: {
  hash: string
  tone?: 'light' | 'plain'
}) {
  const [copied, setCopied] = useState(false)
  const [showRecipe, setShowRecipe] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the hash is on screen to copy by hand.
    }
  }

  return (
    <div
      className={
        tone === 'light'
          ? 'rounded-control border border-line bg-surface-sunken p-4 text-left'
          : 'text-left'
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="ui-label !mb-0">Your anonymous voter ID</p>
        <button
          onClick={copy}
          className="shrink-0 text-xs font-medium text-ink underline underline-offset-2 hover:text-accent-ink"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="mt-2 break-all font-mono text-[0.7rem] leading-relaxed text-ink">{hash}</p>

      <p className="mt-2.5 text-xs leading-relaxed text-ink-faint">
        This is the only thing we receive. Your ticket ID and email were combined and hashed
        here in your browser; neither was sent.
      </p>

      <button
        onClick={() => setShowRecipe(value => !value)}
        className="mt-2 text-xs font-medium text-ink underline underline-offset-2 hover:text-accent-ink"
      >
        {showRecipe ? 'Hide' : 'Check it yourself'}
      </button>

      {showRecipe && (
        <div className="mt-2.5 space-y-2 border-t border-line pt-2.5">
          <p className="text-xs leading-relaxed text-ink-faint">
            We uppercase the ticket, lowercase the email, join them with a{' '}
            <code className="font-mono text-ink">+</code>, and take the SHA-256. Put your own
            two values in below and you should get exactly the number above.
          </p>
          {/* Deliberately a blank template, not the voter's real values filled
              in. Rendering those would mean keeping the raw ticket and email
              around after hashing, and not keeping them is the entire point. */}
          <pre className="overflow-x-auto rounded-control bg-ink/5 p-2.5 font-mono text-[0.65rem] leading-relaxed text-ink">
{`python3 -c "import hashlib; print(
  hashlib.sha256(b'TICKET+you@example.com').hexdigest())"`}
          </pre>
          <p className="text-xs leading-relaxed text-ink-faint">
            Ticket in capitals, email in lower case, no spaces.
          </p>
        </div>
      )}
    </div>
  )
}
