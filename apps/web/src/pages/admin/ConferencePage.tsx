import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api.js'
import { formatDateTime, formatDuration, fromDatetimeLocal, toDatetimeLocal } from '../../lib/time.js'

interface Conference {
  id: string
  name: string
  description: string | null
  voting_opens_at: number | null
  voting_closes_at: number | null
  voting_force_status: 'open' | 'closed' | 'scheduled'
  votes_per_voter: number
  speaker_visibility: 'hidden' | 'basic' | 'full'
  eligible_talk_count: number
  recommended_votes: number
  ballot_locked: boolean
}

interface AuditLog {
  id: string
  action: string
  target_type: string
  target_id: string | null
  details: unknown
  created_at: number
  admin_label: string
}

export default function ConferencePage() {
  const qc = useQueryClient()

  const { data: conf, isLoading } = useQuery({
    queryKey: ['admin-conference'],
    queryFn: () => apiFetch<Conference>('/api/admin/conference').catch(() => null),
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => apiFetch<AuditLog[]>('/api/admin/audit'),
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [forceStatus, setForceStatus] = useState<'open' | 'closed' | 'scheduled'>('scheduled')
  const [votesPerVoter, setVotesPerVoter] = useState('0')
  const [speakerVisibility, setSpeakerVisibility] = useState<'hidden' | 'basic' | 'full'>('basic')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!conf || initialized) return
    setName(conf.name)
    setDescription(conf.description ?? '')
    setOpensAt(toDatetimeLocal(conf.voting_opens_at))
    setClosesAt(toDatetimeLocal(conf.voting_closes_at))
    setForceStatus(conf.voting_force_status)
    setVotesPerVoter(String(conf.votes_per_voter))
    setSpeakerVisibility(conf.speaker_visibility)
    setInitialized(true)
  }, [conf, initialized])

  const saveConference = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      const method = conf ? 'PUT' : 'POST'
      return apiFetch('/api/admin/conference', {
        method,
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-conference'] })
      qc.invalidateQueries({ queryKey: ['conference'] })
      qc.invalidateQueries({ queryKey: ['admin-audit'] })
      setSuccess('Conference saved.')
      setError(null)
    },
    onError: (e: Error) => {
      setError(e.message)
      setSuccess(null)
    },
  })

  const resetBallot = useMutation({
    mutationFn: () => apiFetch<{ votes_deleted: number }>('/api/admin/conference/reset-ballot', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'RESET VOTES' }),
    }),
    onSuccess: (data) => {
      setInitialized(false)
      qc.invalidateQueries()
      setSuccess(`Ballot reset. ${data.votes_deleted} vote(s) deleted.`)
      setError(null)
    },
    onError: (e: Error) => { setError(e.message); setSuccess(null) },
  })

  const voteBudget = parseInt(votesPerVoter || '0', 10)

  const now = Date.now()
  const isForced = forceStatus !== 'scheduled'
  const isCurrentlyOpen = conf
    ? forceStatus === 'open' || (
      forceStatus === 'scheduled' &&
      voteBudget > 0 &&
      Boolean(fromDatetimeLocal(opensAt)) &&
      Boolean(fromDatetimeLocal(closesAt)) &&
      now >= (fromDatetimeLocal(opensAt) ?? 0) &&
      now <= (fromDatetimeLocal(closesAt) ?? 0)
    )
    : false
  const nextBoundary = isCurrentlyOpen ? fromDatetimeLocal(closesAt) : fromDatetimeLocal(opensAt)

  if (isLoading) return <div className="text-sm uppercase tracking-wide text-ink-faint">Loading…</div>

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Organiser</p>
          <h1 className="page-title">{conf ? 'Conference Settings' : 'Create Conference'}</h1>
        </div>
        {conf && (
          <div className="ui-card px-4 py-3 text-sm">
            <span className={isCurrentlyOpen ? 'font-bold uppercase text-positive' : 'font-bold uppercase text-ink-faint'}>
              {isCurrentlyOpen ? 'Voting open' : 'Voting closed'}
            </span>
            {nextBoundary && nextBoundary > now && (
              <span className="ml-2 text-ink-faint">
                {isCurrentlyOpen ? 'closes in' : 'opens in'} {formatDuration(nextBoundary - now)}
              </span>
            )}
          </div>
        )}
      </div>

      {error && <div className="status-error">{error}</div>}
      {success && <div className="status-open">{success}</div>}

      {/* Conference details */}
      <section className="ui-card space-y-4 p-5 sm:p-6">
        <h2 className="section-title">Details</h2>
        <div>
          <label className="ui-label">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="ui-input" />
        </div>
        <div>
          <label className="ui-label">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="ui-input" />
        </div>
        <button onClick={() => saveConference.mutate({ name, description: description || null })} disabled={!name || saveConference.isPending} className="btn-ink">
          {saveConference.isPending ? 'Saving…' : 'Save Details'}
        </button>
      </section>

      {/* Voting window - only show once conference exists */}
      {conf && (
        <section className="ui-card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="section-title">Voting Window</h2>
            <p className="mt-1 text-sm text-ink-faint">
              {isForced ? 'Manual override is active.' : 'Scheduled voting follows the local date and time below.'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="ui-label">Opens At</label>
              <input disabled={conf.ballot_locked} type="datetime-local" value={opensAt} onChange={e => setOpensAt(e.target.value)} className="ui-input" />
            </div>
            <div>
              <label className="ui-label">Closes At</label>
              <input disabled={conf.ballot_locked} type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} className="ui-input" />
            </div>
          </div>
          <div>
            <label className="ui-label mb-2">Override Status</label>
            <div className="flex gap-4">
              {(['scheduled', 'open', 'closed'] as const).map(s => (
                <label key={s} className="flex cursor-pointer items-center gap-1.5 text-sm uppercase tracking-wide">
                  <input type="radio" name="force" value={s} className="accent-stamp"
                    checked={forceStatus === s} onChange={() => setForceStatus(s)} />
                  <span>{s}</span>
                </label>
              ))}
            </div>
            {forceStatus !== 'scheduled' && (
              <p className="mt-1 text-xs text-ink-faint">Override active; schedule dates are ignored.</p>
            )}
          </div>
          <button onClick={() => saveConference.mutate(conf.ballot_locked
            ? { voting_force_status: forceStatus }
            : {
              voting_opens_at: fromDatetimeLocal(opensAt),
              voting_closes_at: fromDatetimeLocal(closesAt),
              voting_force_status: forceStatus,
            }
          )} disabled={saveConference.isPending} className="btn-ink">
            {saveConference.isPending ? 'Saving…' : 'Save Voting Settings'}
          </button>
        </section>
      )}

      {/* Vote budget - only show once conference exists */}
      {conf && (
        <section className="ui-card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="section-title">Vote Budget</h2>
            <p className="mt-1 text-sm text-ink-faint">
              Each voter gets this many votes. Talks are ranked by total votes; duration can be decided later while scheduling.
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {conf.eligible_talk_count} eligible talks → recommended allowance: {conf.recommended_votes}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Formula: max(1, round({conf.eligible_talk_count} ÷ 4)) = {conf.recommended_votes}. This is guidance; you choose the final allowance.
            </p>
          </div>
          <div className="max-w-xs">
            <label className="ui-label">Votes per voter</label>
            <input
              type="number"
              min="0"
              max={conf.eligible_talk_count}
              disabled={conf.ballot_locked}
              value={votesPerVoter}
              onChange={e => setVotesPerVoter(e.target.value)}
              className="ui-input min-h-11"
            />
            <p className="mt-2 text-xs text-ink-faint">
              Set to 0 to keep voting closed until the ballot is ready.
            </p>
            {voteBudget !== conf.recommended_votes && (
              <p className="mt-2 text-xs font-semibold text-ink">
                Recommendation: {conf.recommended_votes}. Configured: {Number.isNaN(voteBudget) ? 0 : voteBudget}.
              </p>
            )}
          </div>
          <button onClick={() => saveConference.mutate({ votes_per_voter: voteBudget })} disabled={conf.ballot_locked || saveConference.isPending || voteBudget < 0 || voteBudget > conf.eligible_talk_count} className="btn-ink">
            {saveConference.isPending ? 'Saving…' : 'Save Vote Budget'}
          </button>
        </section>
      )}

      {conf && (
        <section className="ui-card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="section-title">Speaker Information</h2>
            <p className="mt-1 text-sm text-ink-faint">Private email and internal CFP data are never public.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ['hidden', 'Hidden', 'Talk information only'],
              ['basic', 'Basic', 'Talk information and speaker name'],
              ['full', 'Full', 'Speaker name, biography, and approved public links'],
            ] as const).map(([value, label, help]) => (
              <label key={value} className="ui-card cursor-pointer p-4">
                <input type="radio" name="speaker-visibility" value={value}
                  disabled={conf.ballot_locked}
                  checked={speakerVisibility === value}
                  onChange={() => setSpeakerVisibility(value)} />
                <span className="ml-2 font-bold text-ink">{label}</span>
                <span className="mt-1 block text-xs text-ink-faint">{help}</span>
              </label>
            ))}
          </div>
          <button onClick={() => saveConference.mutate({ speaker_visibility: speakerVisibility })}
            disabled={conf.ballot_locked || saveConference.isPending} className="btn-ink">Save Speaker Visibility</button>
        </section>
      )}

      {conf?.ballot_locked && (
        <section className="ui-card space-y-3 p-5 sm:p-6">
          <h2 className="section-title">Ballot Locked</h2>
          <p className="text-sm text-ink-faint">Voting has started. The talk list, allowance, dates, and speaker visibility can no longer change.</p>
          <button className="btn-label" disabled={resetBallot.isPending} onClick={() => {
            const confirmation = window.prompt('This permanently deletes every vote. Type RESET VOTES to continue.')
            if (confirmation === 'RESET VOTES') resetBallot.mutate()
          }}>Reset Ballot and Delete Votes</button>
        </section>
      )}

      {conf && (
        <section className="ui-card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="section-title">Audit Trail</h2>
            <p className="mt-1 text-sm text-ink-faint">
              Recent admin actions that affect the ballot, access, voting rules, or publication.
            </p>
          </div>
          {auditLogs.length === 0 ? (
            <div className="empty-state">No audit events yet.</div>
          ) : (
            <div className="divide-y divide-ink/15 border-2 border-ink">
              {auditLogs.map(log => (
                <div key={log.id} className="p-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-bold uppercase text-ink">
                      {log.action.replace(/_/g, ' ')} {log.target_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-ink-faint">{formatDateTime(log.created_at)}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    {log.admin_label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
