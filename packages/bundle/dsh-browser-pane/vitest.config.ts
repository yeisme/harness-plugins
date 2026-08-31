import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@yeisme/dsh-browser-host': fileURLToPath(new URL('../../host/dsh-browser-host/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-browser-pane': fileURLToPath(new URL('../../client/ui-browser-pane/src/index.ts', import.meta.url)),
    },
  },
})
