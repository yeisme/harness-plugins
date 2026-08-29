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
      '@yeisme/dsh-workbench-core/client': fileURLToPath(new URL('../dsh-workbench-core/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-rich-media/client': fileURLToPath(new URL('../dsh-rich-media/src/client/index.ts', import.meta.url)),
    },
  },
})
