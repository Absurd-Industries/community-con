/**
 * One accent per track.
 *
 * IndiaFOSS 2026's design language is not a single brand colour - it is nine of
 * them, one per track, and that is the whole point of how the festival sees
 * itself: a community of communities, each doing its own thing under one roof.
 * Communi-Con is the same idea compressed into an hour, so the ballot is
 * visibly many-coloured rather than uniformly branded.
 *
 * Values lifted verbatim from the IndiaFOSS 2026 speaker poster generator
 * (`MAIN_TRACK_COLORS` in generator/script.js).
 */

export const TRACK_PALETTE = [
  'red',
  'yellow',
  'pink',
  'violet',
  'lime',
  'green',
  'mint',
  'blue',
  'ruby',
] as const

export type TrackColor = (typeof TRACK_PALETTE)[number]

/** Hex values, for the rare spot that needs one inline (SVG fills, gradients). */
export const TRACK_HEX: Record<TrackColor, string> = {
  red: '#FF643E',
  yellow: '#F5AB00',
  pink: '#E45CFF',
  violet: '#8A5CFF',
  lime: '#9BC71A',
  green: '#00D668',
  mint: '#00C2AE',
  blue: '#4BA2FF',
  ruby: '#FF3C74',
}

/**
 * Stable track -> colour. The same track name always gets the same accent, on
 * every machine and across reloads, without anyone maintaining a lookup table
 * that drifts out of sync with whatever tracks the CFP actually produced.
 */
export function trackColor(track: string | null | undefined): TrackColor {
  if (!track) return 'red'
  let hash = 0x811c9dc5
  const key = track.trim().toLowerCase()
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return TRACK_PALETTE[hash % TRACK_PALETTE.length]
}

/**
 * Tailwind class bundles per accent.
 *
 * Written out in full rather than interpolated (`bg-track-${c}`) because
 * Tailwind scans source text for class names - a constructed string is a class
 * that never makes it into the stylesheet.
 */
interface TrackClasses {
  /** Tinted pill: darkened track text on a soft wash of the same hue. */
  tag: string
  /** Selected-card ring. Decoration, so it uses the vivid value. */
  ring: string
  /** Solid fill with white text - active filters, rank badges. */
  solid: string
  /** Text colour on white. */
  text: string
  /** Left edge of a card. Decoration. */
  border: string
}

/*
 * Two values per track: the vivid one for decoration (rings, rules, fills that
 * carry no text) and a darkened one wherever the colour has to be READ. White
 * on #F5AB00 is 1.96:1; nobody in row 30 is reading that.
 */

export const TRACK_CLASSES: Record<TrackColor, TrackClasses> = {
  red:    { tag: 'bg-track-red/12 text-trackInk-red',       ring: 'ring-track-red',    solid: 'bg-trackInk-red text-white',    text: 'text-trackInk-red',    border: 'border-l-track-red' },
  yellow: { tag: 'bg-track-yellow/12 text-trackInk-yellow', ring: 'ring-track-yellow', solid: 'bg-trackInk-yellow text-white', text: 'text-trackInk-yellow', border: 'border-l-track-yellow' },
  pink:   { tag: 'bg-track-pink/12 text-trackInk-pink',     ring: 'ring-track-pink',   solid: 'bg-trackInk-pink text-white',   text: 'text-trackInk-pink',   border: 'border-l-track-pink' },
  violet: { tag: 'bg-track-violet/12 text-trackInk-violet', ring: 'ring-track-violet', solid: 'bg-trackInk-violet text-white', text: 'text-trackInk-violet', border: 'border-l-track-violet' },
  lime:   { tag: 'bg-track-lime/12 text-trackInk-lime',     ring: 'ring-track-lime',   solid: 'bg-trackInk-lime text-white',   text: 'text-trackInk-lime',   border: 'border-l-track-lime' },
  green:  { tag: 'bg-track-green/12 text-trackInk-green',   ring: 'ring-track-green',  solid: 'bg-trackInk-green text-white',  text: 'text-trackInk-green',  border: 'border-l-track-green' },
  mint:   { tag: 'bg-track-mint/12 text-trackInk-mint',     ring: 'ring-track-mint',   solid: 'bg-trackInk-mint text-white',   text: 'text-trackInk-mint',   border: 'border-l-track-mint' },
  blue:   { tag: 'bg-track-blue/12 text-trackInk-blue',     ring: 'ring-track-blue',   solid: 'bg-trackInk-blue text-white',   text: 'text-trackInk-blue',   border: 'border-l-track-blue' },
  ruby:   { tag: 'bg-track-ruby/12 text-trackInk-ruby',     ring: 'ring-track-ruby',   solid: 'bg-trackInk-ruby text-white',   text: 'text-trackInk-ruby',   border: 'border-l-track-ruby' },
}

/** Convenience: track name straight to its class bundle. */
export function trackClasses(track: string | null | undefined): TrackClasses {
  return TRACK_CLASSES[trackColor(track)]
}
