import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        // dsh-client-ui-primitives 的 MarkdownText 引入 katex css；inline 后
        // 由 vitest 转换并吞掉 css import，Node ESM 不再直撞 .css。
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
})
