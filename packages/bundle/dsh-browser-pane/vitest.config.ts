import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { server: { deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] } } },
  resolve: {
    alias: {
      '@yeisme/dsh-client-ui-browser-pane/contracts': fileURLToPath(new URL('../../client/ui-browser-pane/src/contracts.ts', import.meta.url)),
      '@yeisme/dsh-browser-host': fileURLToPath(new URL('../../host/dsh-browser-host/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-browser-pane': fileURLToPath(new URL('../../client/ui-browser-pane/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-surface': fileURLToPath(new URL('../../client/ui-surface/src/index.tsx', import.meta.url)),
      '@yeisme/dsh-client-ui-visual-kit': fileURLToPath(new URL('../../client/ui-visual-kit/src/index.ts', import.meta.url)),
    },
  },
})
