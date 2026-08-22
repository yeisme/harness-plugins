import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@yeisme\/dsh-creator-studio-host$/, replacement: fileURLToPath(new URL('../../host/creator-studio/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-pane-protocol$/, replacement: fileURLToPath(new URL('../../host/pane-protocol/src/index.ts', import.meta.url)) },
    ],
  },
})
