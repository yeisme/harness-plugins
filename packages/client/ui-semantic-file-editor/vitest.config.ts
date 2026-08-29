import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: { deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] } },
  },
  resolve: {
    alias: {
      '@yeisme/dsh-language-intelligence-host': fileURLToPath(new URL('../../host/dsh-language-intelligence/src/index.ts', import.meta.url)),
      '@yeisme/dsh-file-host': fileURLToPath(new URL('../../host/dsh-file-host/src/index.ts', import.meta.url)),
      '@yeisme/dsh-file-document': fileURLToPath(new URL('../../bundle/dsh-file-document/src/index.ts', import.meta.url)),
    },
  },
})
