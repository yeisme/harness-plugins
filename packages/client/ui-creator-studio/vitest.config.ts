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
    alias: [
      { find: /^@deepseek-ai\/dsh-client-runtime\/client$/u, replacement: fileURLToPath(new URL('./tests/client-runtime.mock.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-client-ui-pane-workbench$/u, replacement: fileURLToPath(new URL('../ui-pane-workbench/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-creator-studio-host\/contracts$/u, replacement: fileURLToPath(new URL('../../host/creator-studio/src/contracts.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-pane-protocol$/u, replacement: fileURLToPath(new URL('../../host/pane-protocol/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-rich-media\/client$/u, replacement: fileURLToPath(new URL('./tests/rich-media.mock.tsx', import.meta.url)) },
    ],
  },
})
