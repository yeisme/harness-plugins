import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { server: { deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] } } },
  resolve: { alias: [
    { find: /^@yeisme\/dsh-browser-host$/u, replacement: fileURLToPath(new URL('../../host/dsh-browser-host/src/index.ts', import.meta.url)) },
    { find: /^@yeisme\/dsh-client-ui-surface$/u, replacement: fileURLToPath(new URL('../ui-surface/src/index.tsx', import.meta.url)) },
    { find: /^@yeisme\/dsh-client-ui-visual-kit$/u, replacement: fileURLToPath(new URL('../ui-visual-kit/src/index.ts', import.meta.url)) },
  ] },
})
