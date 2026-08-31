export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light ground, white cards, one near-black feature panel.
        surface: { DEFAULT: '#FFFFFF', sunken: '#F0F0F0', raised: '#FAFAFA' },
        ink: { DEFAULT: '#161616', light: '#4A4A4A', faint: '#6B6B6B' },
        line: 'rgba(22, 22, 22, 0.10)',
        // Interaction is ink. Colour is reserved for state, never for emphasis.
        positive: { DEFAULT: '#0F7A4E', soft: 'rgba(15, 122, 78, 0.10)' },
        danger: { DEFAULT: '#C22C2C', soft: 'rgba(194, 44, 44, 0.10)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Ticket IDs, countdowns, vote tallies - anything that should not reflow.
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '1rem',
        control: '0.625rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -8px rgba(0, 0, 0, 0.10)',
        lift: '0 2px 4px rgba(0, 0, 0, 0.05), 0 12px 32px -8px rgba(0, 0, 0, 0.14)',
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
