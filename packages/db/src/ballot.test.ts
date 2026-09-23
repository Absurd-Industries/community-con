import { describe, expect, it } from 'vitest'
import {
  countVotes,
  parseBallotRow,
  placings,
  rankTalks,
  tallyBallots,
  type Ballot,
} from './ballot.js'

const ballot = (voter: string, castAt: number, talkIds: string[] = []): Ballot => ({
  id: `${voter}-${castAt}`,
  voter_hash: voter,
  talk_ids: talkIds,
  cast_at: castAt,
})

describe('tallyBallots', () => {
  it('counts every ballot when no official list is loaded', () => {
    const { ballots, summary } = tallyBallots([ballot('a', 1), ballot('b', 2)], [])
    expect(ballots).toHaveLength(2)
    expect(summary.eligible_tickets).toBeNull()
    expect(summary.from_unknown_tickets).toBe(0)
  })

  it('keeps only the latest ballot from each voter', () => {
    const { ballots, summary } = tallyBallots(
      [ballot('a', 1, ['t1']), ballot('a', 5, ['t2']), ballot('b', 3, ['t1'])],
      []
    )
    expect(summary.superseded).toBe(1)
    expect(summary.counted).toBe(2)
    expect(ballots.find(b => b.voter_hash === 'a')?.talk_ids).toEqual(['t2'])
  })

  it('is not fooled by ballots arriving out of order', () => {
    const { ballots } = tallyBallots([ballot('a', 9, ['late']), ballot('a', 2, ['early'])], [])
    expect(ballots[0].talk_ids).toEqual(['late'])
  })

  it('lets the later submission win when two share a timestamp', () => {
    // The clock can hold still between two fast submissions, so cast_at alone
    // cannot order them. The order they were stored in decides, and a voter's
    // correction must not lose to the ballot it was meant to replace.
    const { ballots } = tallyBallots(
      [ballot('a', 5, ['first']), ballot('a', 5, ['correction'])],
      []
    )
    expect(ballots).toHaveLength(1)
    expect(ballots[0].talk_ids).toEqual(['correction'])
  })

  it('drops ballots whose pair is not on the official list', () => {
    const { summary } = tallyBallots([ballot('a', 1), ballot('ghost', 2)], ['a', 'c'])
    expect(summary.from_unknown_tickets).toBe(1)
    expect(summary.counted).toBe(1)
    // Two tickets were claimed; only one of them voted.
    expect(summary.eligible_tickets).toBe(2)
  })
})

describe('countVotes', () => {
  it('ignores talk ids it does not know', () => {
    const counts = countVotes([ballot('a', 1, ['t1', 'deleted'])], ['t1', 't2'])
    expect(counts.get('t1')).toBe(1)
    expect(counts.get('t2')).toBe(0)
    expect(counts.has('deleted')).toBe(false)
  })
})

describe('rankTalks', () => {
  it('shares a rank on a tie and skips the next', () => {
    const ranked = rankTalks([{ vote_count: 9 }, { vote_count: 5 }, { vote_count: 5 }, { vote_count: 1 }])
    expect(ranked.map(t => t.rank)).toEqual([1, 2, 2, 4])
  })
})

describe('placings', () => {
  it('marks a tie straddling the cutoff as needing a tie-break', () => {
    // Two slots; second place is a three-way tie, so only the winner is safe.
    const result = placings([{ vote_count: 9 }, { vote_count: 4 }, { vote_count: 4 }, { vote_count: 4 }], 2)
    expect(result).toEqual(['selected', 'tie-break', 'tie-break', 'tie-break'])
  })

  it('selects a tie group that fits entirely inside the slots', () => {
    const result = placings([{ vote_count: 4 }, { vote_count: 4 }, { vote_count: 1 }], 2)
    expect(result).toEqual(['selected', 'selected', 'out'])
  })
})

describe('parseBallotRow', () => {
  it('reads talk_ids back out of the JSON column', () => {
    const parsed = parseBallotRow({
      id: 'b1', conference_id: 'c1', voter_hash: 'a', talk_ids: '["t1","t2"]', cast_at: 7,
    })
    expect(parsed.talk_ids).toEqual(['t1', 't2'])
  })

  it('survives an unreadable row rather than taking the tally down', () => {
    const parsed = parseBallotRow({
      id: 'b1', conference_id: 'c1', voter_hash: 'a', talk_ids: 'not json', cast_at: 7,
    })
    expect(parsed.talk_ids).toEqual([])
  })
})
