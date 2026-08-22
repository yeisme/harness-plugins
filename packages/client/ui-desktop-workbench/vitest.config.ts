import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@yeisme/dsh-workbench-core/client': fileURLToPath(new URL('../../bundle/dsh-workbench-core/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-file-document': fileURLToPath(new URL('../../bundle/dsh-file-document/src/index.ts', import.meta.url)),
      '@yeisme/dsh-file-host': fileURLToPath(new URL('../../host/dsh-file-host/src/index.ts', import.meta.url)),
    },
  },
})
