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
    const { pairs } = parseVoterList('IF26-4821,Ashwin@Example.COM\nif26-1170, b@x.org')

    expect(pairs).toEqual([
      { ticket: 'IF26-4821', email: 'ashwin@example.com' },
      { ticket: 'IF26-1170', email: 'b@x.org' },
    ])
  })

  it('skips a header row in either column order', () => {
    expect(parseVoterList('ticket_id,email\nIF26-1,a@x.com').pairs).toHaveLength(1)
    expect(parseVoterList('email,ticket\na@x.com,IF26-1').pairs).toHaveLength(1)
  })

  it('accepts either column order on data rows too', () => {
    expect(parseVoterList('a@x.com,IF26-1').pairs).toEqual([
      { ticket: 'IF26-1', email: 'a@x.com' },
    ])
  })

  it('handles semicolons, tabs and quoted cells', () => {
    expect(parseVoterList('"IF26-1";"a@x.com"').pairs).toEqual([
      { ticket: 'IF26-1', email: 'a@x.com' },
    ])
    expect(parseVoterList('IF26-2\tb@x.com').pairs).toEqual([
      { ticket: 'IF26-2', email: 'b@x.com' },
    ])
  })

  it('ignores blank lines without calling them errors', () => {
    const { pairs, skipped } = parseVoterList('IF26-1,a@x.com\n\n   \nIF26-2,b@x.com\n')

    expect(pairs).toHaveLength(2)
    expect(skipped).toEqual([])
  })

  it('reports unusable lines by line number instead of dropping them', () => {
    const { pairs, skipped } = parseVoterList('IF26-1,a@x.com\nIF26-2\nIF26-3,not-an-email')

    expect(pairs).toHaveLength(1)
    expect(skipped).toEqual([2, 3])
  })

  it('counts exact duplicates once', () => {
    const { pairs, duplicates } = parseVoterList('IF26-1,a@x.com\nif26-1,A@X.com')

    expect(pairs).toHaveLength(1)
    expect(duplicates).toBe(1)
  })

  it('keeps one ticket claimed twice as two separate entries', () => {
    // Different addresses are different voters, even on a lookalike ticket.
    const { pairs, duplicates } = parseVoterList('IF26-1,a@x.com\nIF26-1,b@x.com')

    expect(pairs).toHaveLength(2)
    expect(duplicates).toBe(0)
  })
})
