import { looksLikeEmail, normalizeEmail, normalizeTicket } from './hash.js'

/**
 * Parsing the official list of claimed tickets.
 *
 * An organiser exports this from the ticketing system and pastes it in. It
 * arrives as `ticket_id,email` per line, usually with a header row, sometimes
 * quoted, often with a stray blank line at the end. Be generous about the
 * shape and precise about the contents - a silently dropped row is a voter
 * silently disenfranchised, so anything unparseable is reported, not ignored.
 */

export interface ParsedPair {
  ticket: string
  email: string
}

export interface ParsedVoterList {
  pairs: ParsedPair[]
  /** 1-indexed line numbers that could not be read as a pair. */
  skipped: number[]
  /** Pairs that appeared more than once, after normalisation. */
  duplicates: number
}

const SEPARATOR = /[,;\t|]/
const HEADER = /^(ticket|ticket[_ ]?id|id)$/i

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"').trim()
  }
  return trimmed
}

export function parseVoterList(raw: string): ParsedVoterList {
  const pairs: ParsedPair[] = []
  const skipped: number[] = []
  const seen = new Set<string>()
  let duplicates = 0

  raw.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return // blank lines are not errors

    const cells = line.split(SEPARATOR).map(unquote).filter(Boolean)

    // Header row, in either column order.
    if (cells.length >= 2 && HEADER.test(cells[0]) && /mail/i.test(cells[1])) return
    if (cells.length >= 2 && HEADER.test(cells[1]) && /mail/i.test(cells[0])) return

    if (cells.length < 2) {
      skipped.push(index + 1)
      return
    }

    // Tolerate either column order by looking for the email-shaped cell.
    const emailIndex = cells.findIndex(looksLikeEmail)
    if (emailIndex === -1) {
      skipped.push(index + 1)
      return
    }
    const ticket = cells.find((_, i) => i !== emailIndex) ?? ''
    if (!ticket) {
      skipped.push(index + 1)
      return
    }

    const pair = {
      ticket: normalizeTicket(ticket),
      email: normalizeEmail(cells[emailIndex]),
    }
    const key = `${pair.ticket}+${pair.email}`
    if (seen.has(key)) {
      duplicates++
      return
    }
    seen.add(key)
    pairs.push(pair)
  })

  return { pairs, skipped, duplicates }
}
