import { describe, it, expect } from 'vitest'
import { getVotingStatus } from './voting-status.js'

const base = {
  voting_force_status: 'scheduled' as const,
  voting_opens_at: 1000,
  voting_closes_at: 3000,
  votes_per_voter: 5,
}

describe('getVotingStatus', () => {
  it('returns closed when votes_per_voter is 0', () => {
    expect(getVotingStatus({ ...base, votes_per_voter: 0 }, 2000)).toBe('closed')
  })

  it('returns open when force_status is open regardless of time', () => {
    expect(getVotingStatus({ ...base, voting_force_status: 'open' }, 9999)).toBe('open')
  })

  it('returns closed when force_status is closed regardless of time', () => {
    expect(getVotingStatus({ ...base, voting_force_status: 'closed' }, 2000)).toBe('closed')
  })

  it('returns open when scheduled and within window', () => {
    expect(getVotingStatus(base, 2000)).toBe('open')
  })

  it('returns closed when scheduled and before window', () => {
    expect(getVotingStatus(base, 500)).toBe('closed')
  })

  it('returns closed when scheduled and after window', () => {
    expect(getVotingStatus(base, 4000)).toBe('closed')
  })

  it('returns closed when scheduled but no dates set', () => {
    expect(getVotingStatus({ ...base, voting_opens_at: null, voting_closes_at: null }, 2000)).toBe('closed')
  })
})
