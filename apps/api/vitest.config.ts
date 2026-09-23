import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: '2026-07-20',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: ['DB'],
          bindings: { ADMIN_PASSWORD: 'test-password' },
        },
      },
    },
  },
})
