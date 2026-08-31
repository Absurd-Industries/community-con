import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getVotingStatus } from '@cc/db'
import { setAdminMode, useAdminMode } from '../lib/admin.js'
import { getStore, mutate, resetDemo } from '../mock/store.js'

/**
 * Demo controls.
 *
 * None of this is part of the product. It exists so the preview can be walked
 * through in a meeting without editing timestamps by hand: jump the voting
 * window, publish results, reveal the organiser screens, start over.
 *
 * It writes straight to the store rather than going through the API handlers,
 * because half of these transitions are things the real API correctly refuses.
 */

type VotingState = 'before' | 'open' | 'closed'

const HOUR = 60 * 60 * 1000

export default function DemoBar() {
  const qc = useQueryClient()
  const isAdmin = useAdminMode()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<VotingState | null>(null)
  const [published, setPublished] = useState(false)
  const [ballotCount, setBallotCount] = useState(0)

  async function refresh() {
    const store = await getStore()
    const status = getVotingStatus(store.conference)
    const before =
      status === 'closed' &&
      store.conference.voting_opens_at !== null &&
      Date.now() < store.conference.voting_opens_at
    setState(before ? 'before' : status === 'open' ? 'open' : 'closed')
    setPublished(store.conference.results_public === 1)
    setBallotCount(store.ballots.length)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function applyVotingState(next: VotingState) {
    const now = Date.now()
    await mutate(store => {
      const conf = store.conference
      conf.voting_force_status = 'scheduled'
      if (next === 'before') {
        conf.voting_opens_at = now + 3 * HOUR
        conf.voting_closes_at = now + 23 * HOUR
        conf.results_public = 0
      } else if (next === 'open') {
        conf.voting_opens_at = now - 2 * HOUR
        conf.voting_closes_at = now + 20 * HOUR
        // Results and open voting are mutually exclusive in the real API too.
        conf.results_public = 0
      } else {
        conf.voting_opens_at = now - 22 * HOUR
        conf.voting_closes_at = now - 1 * HOUR
      }
    })
    qc.invalidateQueries()
    await refresh()
  }

  async function togglePublished() {
    await mutate(store => {
      const next = store.conference.results_public === 1 ? 0 : 1
      store.conference.results_public = next
      // Publishing implies voting has ended.
      if (next === 1 && getVotingStatus(store.conference) === 'open') {
        store.conference.voting_closes_at = Date.now() - 60_000
      }
    })
    qc.invalidateQueries()
    await refresh()
  }

  async function handleReset() {
    await resetDemo()
    try {
      window.sessionStorage.removeItem('community-con:ticket')
      window.sessionStorage.removeItem('community-con:selection')
    } catch {
      /* nothing to clear */
    }
    qc.invalidateQueries()
    await refresh()
    window.location.reload()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-[70] flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-faint shadow-card transition-colors hover:text-ink"
        aria-label="Open demo controls"
      >
        <i className="ph ph-sliders-horizontal" aria-hidden="true" />
        Demo
      </button>
    )
  }

  return (
    <aside
      className="fixed bottom-3 left-3 z-[70] w-64 rounded-card border border-line bg-surface p-4 shadow-lift"
      aria-label="Demo controls"
    >
      <div className="flex items-center justify-between">
        <p className="eyebrow">Demo controls</p>
        <button
          onClick={() => setOpen(false)}
          className="text-ink-faint hover:text-ink"
          aria-label="Hide demo controls"
        >
          <i className="ph-bold ph-x" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-faint">
        Not part of the product. Everything here is local to your browser.
      </p>

      <div className="mt-3">
        <p className="ui-label mb-1.5">Voting</p>
        <div className="flex gap-1">
          {(['before', 'open', 'closed'] as const).map(option => (
            <button
              key={option}
              onClick={() => applyVotingState(option)}
              className={[
                'flex-1 rounded-md border px-2 py-1.5 text-[0.7rem] font-medium capitalize transition-colors',
                state === option
                  ? 'border-ink bg-ink text-surface'
                  : 'border-line text-ink-faint hover:border-ink/30 hover:text-ink',
              ].join(' ')}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-line pt-3">
        <Toggle label="Results published" checked={published} onChange={togglePublished} />
        <Toggle label="Organiser view" checked={isAdmin} onChange={() => setAdminMode(!isAdmin)} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[0.7rem] text-ink-faint">
          {ballotCount} ballot{ballotCount === 1 ? '' : 's'} in the log
        </span>
        <button onClick={handleReset} className="btn-ghost btn-sm !px-2 !py-1 !text-[0.7rem]">
          Reset data
        </button>
      </div>
    </aside>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-ink">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={[
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-ink' : 'bg-ink/15',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full bg-surface transition-transform',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
    </label>
  )
}
