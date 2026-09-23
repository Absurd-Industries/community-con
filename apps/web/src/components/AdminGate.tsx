import { useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api.js'
import { clearAdminPassword, setAdminPassword, useAdminMode } from '../lib/admin.js'

/**
 * The organiser door, from the browser's side.
 *
 * One password, shared between the people running the vote. It is checked
 * against the server before anything organiser-shaped is shown, so a wrong
 * password fails here rather than halfway through a page of empty tables.
 *
 * This is not a login and does not pretend to be one. It guards the screens
 * that can delete talks and wipe ballots; it does not identify anybody.
 */
export default function AdminGate({ children }: { children: ReactNode }) {
  const isUnlocked = useAdminMode()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!password.trim()) return
    setBusy(true)
    setError(null)
    try {
      setAdminPassword(password)
      await apiFetch('/api/admin/session')
      // Anything cached from before the unlock was fetched without a password.
      qc.invalidateQueries()
    } catch (caught) {
      clearAdminPassword()
      setError(caught instanceof Error ? caught.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  if (isUnlocked) return <>{children}</>

  return (
    <div className="mx-auto max-w-sm">
      <div className="card p-6">
        <i className="ph ph-lock-simple text-2xl text-ink-faint" aria-hidden="true" />
        <h1 className="section-title mt-3 text-ink">Organiser access</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-faint">
          These screens set up the ballot and count the votes. Ask whoever is running the
          vote for the password.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label htmlFor="admin-password" className="ui-label">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={event => setPassword(event.target.value)}
            className="ui-input"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy || !password.trim()} className="btn-primary btn-sm w-full">
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>

        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Forgotten when you close this tab.
        </p>
      </div>
    </div>
  )
}
