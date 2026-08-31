import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No proxy and no API target: the preview serves its own data from
// localStorage (src/mock/). See README.
export default defineConfig({
  plugins: [react()],
})
