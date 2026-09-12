import { defineConfig } from 'vitest/config'

// Match the existing Pane Workbench runner when exercising real shared primitives.
export default defineConfig({
  test: { server: { deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] } } },
})
