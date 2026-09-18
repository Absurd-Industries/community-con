/**
 * Design tokens.
 *
 * Track colours are lifted verbatim from the IndiaFOSS 2026 speaker poster
 * generator (`MAIN_TRACK_COLORS` in its script.js). The festival's identity is
 * not one brand colour but nine, one per track, which is the point: a community
 * of communities. See src/lib/track-colors.ts.
 *
 * Interaction is green (#08B54D) and sits apart from those nine, so "this is
 * clickable" never reads as "this belongs to a track".
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#FFFFFF', sunken: '#F0F0F0', raised: '#FAFAFA' },
        ink: { DEFAULT: '#1A1A1A', light: '#4A4A4A', faint: '#6B6B6B' },
        line: 'rgba(26, 26, 26, 0.10)',

        /**
         * The interaction colour. Buttons are white on `DEFAULT`.
         *
         * `strong` is the hover, and is deliberately deep enough that white on
         * it clears WCAG AA at 4.57:1. White on `DEFAULT` is 2.72:1, which does
         * not. Making the rest state pass too is a one-line swap in
         * `.btn-primary` (src/index.css).
         */
        accent: {
          DEFAULT: '#08B54D',
          strong: '#06883A', // hover; white on it is 4.57:1
          soft: 'rgba(8, 181, 77, 0.12)',
          ink: '#068137', // green TEXT on white, AA at 5.0:1
        },

        /**
         * One per track. Never used for emphasis, only for identity.
         *
         * `track` is the festival's own vivid value - correct for fills, rings
         * and rules, where nothing has to be legible on top of it.
         */
        track: {
          red: '#FF643E',
          yellow: '#F5AB00',
          pink: '#E45CFF',
          violet: '#8A5CFF',
          lime: '#9BC71A',
          green: '#00D668',
          mint: '#00C2AE',
          blue: '#4BA2FF',
          ruby: '#FF3C74',
        },

        /**
         * The same nine, darkened until they clear WCAG AA (4.5:1) both on
         * white and on their own 12% tint. Small uppercase pill type needs it -
         * white on #F5AB00 is 1.96:1, which is unreadable in a hall.
         * Use these wherever a track colour carries TEXT.
         */
        trackInk: {
          red: '#BA492D',
          yellow: '#956800',
          pink: '#A442B8',
          violet: '#7850DE',
          lime: '#5F7910',
          green: '#00803E',
          mint: '#007C6F',
          blue: '#3471B2',
          ruby: '#C72F5A',
        },

        // One green in the system, not two: "open" and "chosen" read as the
        // same family as the interaction colour rather than competing with it.
        positive: { DEFAULT: '#068137', soft: 'rgba(8, 181, 77, 0.12)' },
        danger: { DEFAULT: '#C22C2C', soft: 'rgba(194, 44, 44, 0.10)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Ticket IDs, countdowns, vote tallies - anything that should not reflow.
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '1rem',
        control: '0.5rem', // IndiaFOSS inputs and buttons are 8px
        pill: '14px', // the segmented poster pill
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -8px rgba(0, 0, 0, 0.10)',
        lift: '0 2px 4px rgba(0, 0, 0, 0.05), 0 12px 32px -8px rgba(0, 0, 0, 0.14)',
        accent: '0 4px 14px -4px rgba(6, 129, 55, 0.45)',
      },
      backgroundImage: {
        /** The festival's maze motif, as an alpha mask. See index.css `.maze`. */
        maze: "url('/images/indiafoss-maze.webp')",
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: {
          '0%': { transform: 'scale(0.98)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
