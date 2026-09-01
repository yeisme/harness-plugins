import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
  resolve: {
    alias: {
      '@yeisme/dsh-workbench-core/client': fileURLToPath(new URL('../../bundle/dsh-workbench-core/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-file-document': fileURLToPath(new URL('../../bundle/dsh-file-document/src/index.ts', import.meta.url)),
      '@yeisme/dsh-file-host': fileURLToPath(new URL('../../host/dsh-file-host/src/index.ts', import.meta.url)),
      '@yeisme/dsh-language-intelligence-host': fileURLToPath(new URL('../../host/dsh-language-intelligence/src/index.ts', import.meta.url)),
      '@yeisme/dsh-session-manager': fileURLToPath(new URL('../../host/dsh-session-manager/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-semantic-file-editor': fileURLToPath(new URL('../ui-semantic-file-editor/src/index.tsx', import.meta.url)),
    },
  },
})
