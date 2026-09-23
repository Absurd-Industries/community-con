import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * In production one Worker serves both the site and the API, so the app calls
 * /api/* on its own origin. This proxy reproduces that in development, where
 * the two are separate processes: `npm run dev:api` on 8787, Vite on 5173.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
