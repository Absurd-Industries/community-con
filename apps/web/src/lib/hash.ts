/**
 * Voter identity, hashed in the browser.
 *
 * A ticket ID alone does not identify a participant. A ticket has to be
 * *claimed*, and claiming pairs it with an email address; the ticketing system
 * refuses to bind one email to several tickets. So the pair - and only the pair
 * - uniquely identifies a person.
 *
 * Both values are hashed together here and neither ever leaves the tab they
 * were typed into. A leaked ballot store should not be a list of who attended,
 * nor a list of their email addresses.
 */

/**
 * SHA-256 of exactly the string given, hex-encoded. No normalisation - callers
 * decide that, because what counts as "the same input" differs per field.
 *
 * `crypto.subtle` needs a secure context - fine on https and on localhost, but
 * absent if someone opens a built `dist/` straight off the filesystem. The
 * fallback keeps that case working. It is NOT a cryptographic hash and must not
 * survive into production; the console warning is there to make sure it doesn't.
 */
export async function sha256Hex(input: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  }

  console.warn(
    '[community-con] crypto.subtle unavailable (insecure context) - falling back to a ' +
      'non-cryptographic hash. Serve over https or localhost for the real thing.'
  )
  return insecureFallbackHash(input)
}

/**
 * The voter's identity. THE ONLY thing that should ever produce a voter hash.
 *
 * ---------------------------------------------------------------------------
 * BACKEND TEAM - the canonical recipe. Both sides must produce identical bytes
 * or every ballot is orphaned:
 *
 *     voter_hash = SHA256_hex( upper(trim(ticket)) + "+" + lower(trim(email)) )
 *
 *     ("  k7m2p9 ", "Ashwin@Example.COM ")
 *       -> "K7M2P9+ashwin@example.com"
 *       -> "c1f0…"
 *
 * The normalisation is not cosmetic. Someone who types `Ashwin@Gmail.com` on
 * Saturday and `ashwin@gmail.com` on Sunday has to come out as ONE voter -
 * otherwise their first ballot is never superseded and both get counted.
 *
 * Uppercase the ticket, lowercase the email. The literal "+" separates them so
 * that ("k7m2p", "9a@x.com") and ("k7m2p9", "a@x.com") cannot collide.
 * ---------------------------------------------------------------------------
 */
export async function voterIdHash(ticket: string, email: string): Promise<string> {
  return sha256Hex(`${normalizeTicket(ticket)}+${normalizeEmail(email)}`)
}

export function normalizeTicket(raw: string): string {
  return raw.trim().toUpperCase()
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

function insecureFallbackHash(value: string): string {
  // Four FNV-1a passes with different offset bases, concatenated to 32 hex
  // chars. Enough to keep the demo's lookups working; nothing more.
  const OFFSETS = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
  return OFFSETS.map(offset => {
    let hash = offset >>> 0
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return hash.toString(16).padStart(8, '0')
  }).join('')
}

/**
 * `k7m2p9` -> `••••p9`. Safe to show back to the voter.
 *
 * Only ever the last two characters. The old first-four-plus-last-two scheme
 * printed a six-character ticket in full, in the ballot header, for anyone
 * looking over the voter's shoulder.
 */
export function maskTicket(raw: string): string {
  const value = raw.trim()
  if (value.length <= 2) return '••••'
  return `••••${value.slice(-2)}`
}

/**
 * `ashwin@example.com` -> `a•••@example.com`.
 *
 * Enough for the voter to recognise their own address, not enough for someone
 * reading over their shoulder to learn it.
 */
export function maskEmail(raw: string): string {
  const value = raw.trim()
  const at = value.lastIndexOf('@')
  if (at < 1) return value ? '•'.repeat(Math.min(value.length, 8)) : ''
  const local = value.slice(0, at)
  const domain = value.slice(at)
  if (local.length <= 1) return `${local}${domain}`
  return `${local[0]}${'•'.repeat(Math.min(local.length - 1, 3))}${domain}`
}

/**
 * Does this look like an email address?
 *
 * Deliberately shallow. This checks the SHAPE OF WHAT WAS TYPED so a voter
 * catches their own typo - it does not, and must not, check whether the address
 * or the ticket exists. The moment this form can distinguish a real pair from
 * an invented one, it becomes an oracle for enumerating attendees.
 */
export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(raw.trim())
}

/**
 * Hash a whole list of claimed (ticket, email) pairs.
 *
 * The organiser's official ticket list goes through this before anything is
 * sent. The server receives hashes only - the same hashes voters' browsers
 * produced - so the list of who holds a ticket never leaves the organiser's
 * machine either.
 */
export function hashPairs(pairs: Array<{ ticket: string; email: string }>): Promise<string[]> {
  return Promise.all(pairs.map(pair => voterIdHash(pair.ticket, pair.email)))
}
