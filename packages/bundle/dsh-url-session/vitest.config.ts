import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // ui-primitives 带内联 katex css（mcp-inspector 同坑）：inline 装载。
    server: { deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] } },
  },
})
