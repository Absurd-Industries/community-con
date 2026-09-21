import { describe, expect, it } from 'vitest'
import { parseVoterList } from './voter-list.js'

/**
 * The official list arrives as a paste from a ticketing export, so it is
 * messy by nature. A row read wrongly is a voter disenfranchised, so the rule
 * is: be generous about shape, strict about contents, and never drop a line
 * silently.
 */
describe('parseVoterList', () => {
  it('reads ticket,email pairs and normalises them', () => {
    const { pairs } = parseVoterList('k7m2p9,Ashwin@Example.COM\nh3q8w4, b@x.org')

    expect(pairs).toEqual([
      { ticket: 'K7M2P9', email: 'ashwin@example.com' },
      { ticket: 'H3Q8W4', email: 'b@x.org' },
    ])
  })

  it('skips a header row in either column order', () => {
    expect(parseVoterList('ticket_id,email\nABC111,a@x.com').pairs).toHaveLength(1)
    expect(parseVoterList('email,ticket\na@x.com,ABC111').pairs).toHaveLength(1)
  })

  it('accepts either column order on data rows too', () => {
    expect(parseVoterList('a@x.com,ABC111').pairs).toEqual([
      { ticket: 'ABC111', email: 'a@x.com' },
    ])
  })

  it('handles semicolons, tabs and quoted cells', () => {
    expect(parseVoterList('"ABC111";"a@x.com"').pairs).toEqual([
      { ticket: 'ABC111', email: 'a@x.com' },
    ])
    expect(parseVoterList('ABC222\tb@x.com').pairs).toEqual([
      { ticket: 'ABC222', email: 'b@x.com' },
    ])
  })

  it('ignores blank lines without calling them errors', () => {
    const { pairs, skipped } = parseVoterList('ABC111,a@x.com\n\n   \nABC222,b@x.com\n')

    expect(pairs).toHaveLength(2)
    expect(skipped).toEqual([])
  })

  it('reports unusable lines by line number instead of dropping them', () => {
    const { pairs, skipped } = parseVoterList('ABC111,a@x.com\nABC222\nABC333,not-an-email')

    expect(pairs).toHaveLength(1)
    expect(skipped).toEqual([2, 3])
  })

  it('counts exact duplicates once', () => {
    const { pairs, duplicates } = parseVoterList('ABC111,a@x.com\nabc111,A@X.com')

    expect(pairs).toHaveLength(1)
    expect(duplicates).toBe(1)
  })

  it('keeps one ticket claimed twice as two separate entries', () => {
    // Different addresses are different voters, even on a lookalike ticket.
    const { pairs, duplicates } = parseVoterList('ABC111,a@x.com\nABC111,b@x.com')

    expect(pairs).toHaveLength(2)
    expect(duplicates).toBe(0)
  })
})
