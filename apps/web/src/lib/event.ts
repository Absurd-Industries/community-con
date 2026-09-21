/**
 * Communi-Con @ IndiaFOSS 2026 - the facts.
 *
 * Everything here is real and verifiable against the event listing:
 * https://fossunited.org/c/indiafoss/2026communi-con
 *
 * This is the single source of truth. Copy, seed data, meta tags and the social
 * card all read from it, so there is exactly one place to edit when the
 * schedule moves.
 */

export const EVENT = {
  name: 'Communi-Con',
  fullName: 'Communi-Con @ IndiaFOSS 2026',
  tagline: 'Everyone has a shot at a 10 minute slot on our biggest stage.',

  conference: 'IndiaFOSS 2026',
  hall: 'Hall 1',
  venue: 'NIMHANS Convention Centre',
  city: 'Bengaluru',

  /** Flash-talk slots on the day. Also the vote budget: one vote per slot. */
  slotCount: 7,
  /** Minutes per talk. No Q&A. */
  slotMinutes: 10,
  /** Rounded, and the number the listing quotes. */
  audience: '800+',

  contactEmail: 'indiafoss@fossunited.org',

  /**
   * Who runs THIS voting system. Not FOSS United: an independent community.
   * The site must never present itself as an official FOSS United property.
   */
  operator: 'Absurd Industries',

  links: {
    event: 'https://fossunited.org/c/indiafoss/2026communi-con',
    submit: 'https://fossunited.org/dashboard/cfp/apply/indiafoss/2026communi-con',
    proposals: 'https://fossunited.org/dashboard/cfp/all/indiafoss/2026communi-con',
    fossUnited: 'https://fossunited.org',
    indiafoss: 'https://fossunited.org/indiafoss/2026',
    /** This voting system's own source. */
    source: 'https://github.com/Absurd-Industries/community-con',
  },
} as const

/**
 * The schedule, in IST.
 *
 * Written as explicit +05:30 instants rather than local-time strings so the
 * countdown is correct from any timezone - someone previewing this from Berlin
 * should see the same deadline as someone in the hall.
 */
const IST = '+05:30'
const at = (isoLocal: string) => new Date(`${isoLocal}${IST}`).getTime()

export const SCHEDULE = {
  /** Proposals open. */
  cfpOpensAt: at('2026-09-25T01:00:00'),
  /** Proposals close - end of day one. */
  cfpClosesAt: at('2026-09-26T16:00:00'),
  /** Ballot opens, an hour after the CFP shuts. */
  votingOpensAt: at('2026-09-26T17:00:00'),
  /** Ballot closes, noon on day two. */
  votingClosesAt: at('2026-09-27T12:00:00'),
  /** Winners announced. */
  resultsAt: at('2026-09-27T14:00:00'),
  /** On stage, Hall 1. */
  stageStartsAt: at('2026-09-27T15:30:00'),
  stageEndsAt: at('2026-09-27T16:45:00'),
} as const

/**
 * Formatted in IST regardless of where the browser is, with the zone named.
 * A deadline the reader has to convert in their head is a deadline they miss.
 */
export function formatIst(timestamp: number, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(timestamp).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    ...opts,
  })
}

/** `Sat, 5:00 pm` - a day and a time, where the date is already established. */
export function formatIstDayTime(timestamp: number) {
  return formatIst(timestamp, { day: undefined, month: undefined })
}

/** `2:00 pm` - bare time, for mid-sentence use. */
export function formatIstTime(timestamp: number) {
  return formatIst(timestamp, { weekday: undefined, day: undefined, month: undefined })
}
