import { describe, expect, it } from 'vitest'
import { ballotTalkCount, isBallotLocked, recommendedVotes } from './ballot-policy.js'

describe('recommendedVotes', () => {
  it.each([
    [0, 0],
    [1, 1],
    [3, 1],
    [6, 2],
    [35, 9],
  ])('recommends %i votes for %i eligible talks', (talkCount, expected) => {
    expect(recommendedVotes(talkCount)).toBe(expected)
  })
})

describe('ballotTalkCount', () => {
  it('uses the locked snapshot after voting starts', () => {
    expect(ballotTalkCount(7, 8)).toBe(8)
  })

  it('uses the current eligible count for a draft', () => {
    expect(ballotTalkCount(7, null)).toBe(7)
  })
})

describe('isBallotLocked', () => {
  const conference = {
    ballot_locked_at: null,
    voting_force_status: 'scheduled' as const,
    voting_opens_at: 1_000,
  }

  it('is unlocked before a scheduled opening', () => {
    expect(isBallotLocked(conference, 999)).toBe(false)
  })

  it('locks at the scheduled opening even if no request recorded the transition', () => {
    expect(isBallotLocked(conference, 1_000)).toBe(true)
  })

  it('locks whenever voting is forced open', () => {
    expect(isBallotLocked({ ...conference, voting_force_status: 'open' }, 500)).toBe(true)
  })

  it('stays locked after an explicit lock is recorded', () => {
    expect(isBallotLocked({ ...conference, voting_force_status: 'closed', ballot_locked_at: 800 }, 900)).toBe(true)
  })
})
