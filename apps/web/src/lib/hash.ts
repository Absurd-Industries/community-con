/**
 * SHA-256, hex-encoded.
 *
 * Ticket IDs are hashed before they touch storage or a ballot, so the demo's
 * data model is already the one the backend team will want: the raw ticket
 * never leaves the tab it was typed into.
 *
 * `crypto.subtle` needs a secure context - fine on https and on localhost, but
 * absent if someone opens a built `dist/` straight off the filesystem. The
 * fallback keeps that case working. It is NOT a cryptographic hash and must not
 * survive into production; the console warning is there to make sure it doesn't.
 */
export async function sha256Hex(input: string): Promise<string> {
  const normalized = input.trim().toUpperCase()

  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(normalized)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  }

  console.warn(
    '[community-con] crypto.subtle unavailable (insecure context) - falling back to a ' +
      'non-cryptographic hash. Serve over https or localhost for the real thing.'
  )
  return insecureFallbackHash(normalized)
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

/** `IF26-4821` -> `IF26-…21`. Safe to show back to the voter. */
export function maskTicket(raw: string): string {
  const value = raw.trim()
  if (value.length <= 4) return '•'.repeat(value.length)
  return `${value.slice(0, 4)}…${value.slice(-2)}`
}
