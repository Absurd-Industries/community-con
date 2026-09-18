import { describe, expect, it } from 'vitest'
import { tally, voteCounts, type Ballot, type DemoStore } from './store.js'
import { sha256Hex, voterIdHash } from '../lib/hash.js'

/**
 * `tally` is the whole voting model. Everything that shows a vote count reads
 * through it, so these cases are the spec: accept blindly, discard at tally.
 */

function ballot(ticket: string, talks: string[], castAt: number): Ballot {
  return { id: `${ticket}@${castAt}`, voter_hash: ticket, talk_ids: talks, cast_at: castAt }
}

function store(ballots: Ballot[], validTickets: string[] = []): DemoStore {
  return {
    conference: { id: 'c', votes_per_voter: 3 } as DemoStore['conference'],
    talks: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] as DemoStore['talks'],
    ballots,
    valid_voter_hashes: validTickets,
    audit_logs: [],
    tie_breaks: [],
  }
}

describe('tally', () => {
  it('counts every ballot when no ticket list has been loaded', () => {
    const { ballots, summary } = tally(store([
      ballot('alice', ['t1'], 100),
      ballot('nobody', ['t2'], 200),
    ]))

    expect(ballots).toHaveLength(2)
    expect(summary.from_unknown_tickets).toBe(0)
    // Null, not zero: there is no denominator until a list exists.
    expect(summary.eligible_tickets).toBeNull()
  })

  it('discards ballots from tickets that are not on the list', () => {
    const { ballots, summary } = tally(store(
      [ballot('alice', ['t1'], 100), ballot('nobody', ['t2'], 200)],
      ['alice', 'bob']
    ))

    expect(ballots.map(b => b.voter_hash)).toEqual(['alice'])
    expect(summary.from_unknown_tickets).toBe(1)
    expect(summary.counted).toBe(1)
    // bob holds a ticket and never voted; turnout must still know he exists.
    expect(summary.eligible_tickets).toBe(2)
  })

  it('keeps only the latest ballot per ticket', () => {
    const { ballots, summary } = tally(store([
      ballot('alice', ['t1'], 100),
      ballot('alice', ['t2', 't3'], 300),
      ballot('alice', ['t1'], 200),
    ], ['alice']))

    expect(ballots).toHaveLength(1)
    expect(ballots[0].talk_ids).toEqual(['t2', 't3'])
    expect(summary.superseded).toBe(2)
  })

  it('does not let a superseded ballot from an unknown ticket count twice', () => {
    const { summary } = tally(store([
      ballot('ghost', ['t1'], 100),
      ballot('ghost', ['t2'], 200),
    ], ['alice']))

    expect(summary.ballots_cast).toBe(2)
    expect(summary.from_unknown_tickets).toBe(2)
    expect(summary.superseded).toBe(0)
    expect(summary.counted).toBe(0)
  })

  it('resubmitting replaces picks rather than adding to them', () => {
    const counts = voteCounts(store([
      ballot('alice', ['t1', 't2'], 100),
      ballot('alice', ['t3'], 200),
    ], ['alice']))

    expect(counts.get('t1')).toBe(0)
    expect(counts.get('t2')).toBe(0)
    expect(counts.get('t3')).toBe(1)
  })

  it('ignores talk ids that no longer resolve', () => {
    const counts = voteCounts(store([ballot('alice', ['t1', 'deleted'], 100)], ['alice']))

    expect(counts.get('t1')).toBe(1)
    expect([...counts.keys()]).not.toContain('deleted')
  })
})

/**
 * The identity itself.
 *
 * A ticket ID alone is not a voter - a claimed ticket is a (ticket, email)
 * pair. These cases pin the normalisation, because the backend has to
 * reproduce it byte-for-byte and any drift silently splits one person into two.
 */
describe('voterIdHash', () => {
  it('is stable across the ways a person types their own details', async () => {
    const canonical = await voterIdHash('IF26-4821', 'ashwin@example.com')

    // Same human, second visit: shouted ticket, capitalised email, stray spaces.
    expect(await voterIdHash('if26-4821 ', ' Ashwin@Example.COM')).toBe(canonical)
    expect(await voterIdHash('  IF26-4821', 'ASHWIN@EXAMPLE.COM ')).toBe(canonical)
  })

  it('separates the two fields so they cannot run together', async () => {
    // Without the "+" these would both hash "IF26-12a@x.com" and collide,
    // handing one person's ballot to another.
    expect(await voterIdHash('IF26-1', '2a@x.com')).not.toBe(
      await voterIdHash('IF26-12', 'a@x.com')
    )
  })

  it('treats one ticket claimed by two addresses as two voters', async () => {
    expect(await voterIdHash('IF26-4821', 'a@example.com')).not.toBe(
      await voterIdHash('IF26-4821', 'b@example.com')
    )
  })

  it('matches the documented recipe exactly', async () => {
    // SHA-256 of the literal string "IF26-4821+ashwin@example.com". If this
    // fails, the backend and the browser have drifted apart.
    expect(await voterIdHash('IF26-4821', 'ashwin@example.com')).toBe(
      await sha256Hex('IF26-4821+ashwin@example.com')
    )
  })

  it('collapses a case-variant resubmission into one counted ballot', async () => {
    const first = await voterIdHash('IF26-4821', 'ashwin@example.com')
    const second = await voterIdHash('if26-4821', 'Ashwin@Example.com')

    const { ballots, summary } = tally(store(
      [ballot(first, ['t1'], 100), ballot(second, ['t2'], 200)],
      [first]
    ))

    expect(ballots).toHaveLength(1)
    expect(ballots[0].talk_ids).toEqual(['t2'])
    expect(summary.superseded).toBe(1)
    expect(summary.from_unknown_tickets).toBe(0)
  })
})
