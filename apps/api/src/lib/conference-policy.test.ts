import { describe, expect, it } from 'vitest'
import { conferencePatchTouchesLockedBallot, validateTieBreak, validateVoteAllowance } from './conference-policy.js'

describe('validateVoteAllowance', () => {
  it('allows zero while the ballot is a draft', () => {
    expect(validateVoteAllowance(0, 35, false)).toBeNull()
  })

  it('requires a positive allowance before opening', () => {
    expect(validateVoteAllowance(0, 35, true)).toBe('Set at least 1 vote per voter before opening voting.')
  })

  it('rejects an allowance larger than the eligible ballot', () => {
    expect(validateVoteAllowance(10, 9, false)).toBe('Votes per voter cannot exceed the 9 eligible talks.')
  })
})

describe('validateTieBreak', () => {
  it('accepts a selected talk from an equal-count tie group', () => {
    expect(validateTieBreak('a', ['a', 'b'], [{ id: 'a', vote_count: 5 }, { id: 'b', vote_count: 5 }])).toBeNull()
  })

  it('rejects talks with different community totals', () => {
    expect(validateTieBreak('a', ['a', 'b'], [{ id: 'a', vote_count: 5 }, { id: 'b', vote_count: 4 }]))
      .toBe('Tie-break talks must have equal community vote totals.')
  })
})

describe('conferencePatchTouchesLockedBallot', () => {
  it.each(['votes_per_voter', 'voting_opens_at', 'voting_closes_at', 'speaker_visibility'])(
    'protects %s after voting starts',
    (field) => expect(conferencePatchTouchesLockedBallot({ [field]: 1 })).toBe(true),
  )

  it('allows descriptive and status-only updates', () => {
    expect(conferencePatchTouchesLockedBallot({ name: 'Updated', voting_force_status: 'closed' })).toBe(false)
  })
})
