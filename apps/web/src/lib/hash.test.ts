import { describe, expect, it } from 'vitest'
import { maskEmail, maskTicket, normalizeEmail, normalizeTicket, sha256Hex, voterIdHash } from './hash.js'

/**
 * The hash contract, pinned.
 *
 * Everyone involved has to be able to reproduce these numbers independently -
 * the voter's browser, the Worker, and whoever audits the result afterwards
 * with their own script. If a change here makes a test fail, it has invalidated
 * every ballot already cast, and that is exactly what the failure is for.
 */

describe('sha256Hex', () => {
  it('matches what any other SHA-256 implementation produces', () => {
    // Reproduce with:
    //   python3 -c "import hashlib;print(hashlib.sha256(b'ticketid-email').hexdigest())"
    return expect(sha256Hex('ticketid-email')).resolves.toBe(
      'ae0301578b87ae915619f1465ed32cdbd0b13b0eb0be38054eac0af290fbe036'
    )
  })

  it('matches for the empty string too', () => {
    return expect(sha256Hex('')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  })
})

describe('voterIdHash', () => {
  it('hashes UPPERCASE-ticket + "+" + lowercase-email', async () => {
    // The recipe spelled out, so a reader can check it by hand:
    //   ("k7m2p9", "ashwin@example.com") -> "K7M2P9+ashwin@example.com"
    const expected = await sha256Hex('K7M2P9+ashwin@example.com')
    await expect(voterIdHash('k7m2p9', 'ashwin@example.com')).resolves.toBe(expected)
  })

  it('treats the same person on two days as one voter', async () => {
    // Otherwise their Saturday ballot is never superseded and both get counted.
    const saturday = await voterIdHash('  k7m2p9 ', 'Ashwin@Example.COM ')
    const sunday = await voterIdHash('K7M2P9', 'ashwin@example.com')
    expect(saturday).toBe(sunday)
  })

  it('keeps pairs apart that would otherwise run together', async () => {
    // Without the "+", both of these would hash "k7m2p9a@x.com".
    const a = await voterIdHash('k7m2p', '9a@x.com')
    const b = await voterIdHash('k7m2p9', 'a@x.com')
    expect(a).not.toBe(b)
  })

  it('is 64 hex characters, which is what the server will accept', async () => {
    expect(await voterIdHash('xxxxxx', 'someone@example.com')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('normalisation', () => {
  it('uppercases the ticket and lowercases the email', () => {
    expect(normalizeTicket('  k7m2p9 ')).toBe('K7M2P9')
    expect(normalizeEmail(' Ashwin@Example.COM ')).toBe('ashwin@example.com')
  })
})

describe('masking', () => {
  it('shows a voter only the last two characters of their ticket', () => {
    expect(maskTicket('k7m2p9')).toBe('••••p9')
  })

  it('leaves an email recognisable to its owner and no one else', () => {
    expect(maskEmail('ashwin@example.com')).toBe('a•••@example.com')
  })
})
