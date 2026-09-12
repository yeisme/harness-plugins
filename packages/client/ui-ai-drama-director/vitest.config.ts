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
      // @yeisme/dsh-rich-media/client 的 lib/client.js 是 DSH ModuleLoader
      // 单文件浏览器产物（顶层引用 window.__ModuleLoader__），Node 收集期
      // 无法求值；ui-creator-studio 自己的测试套件用同一 mock 直连源码。
      { find: /^@yeisme\/dsh-rich-media\/client$/u, replacement: fileURLToPath(new URL('../ui-creator-studio/tests/rich-media.mock.tsx', import.meta.url)) },
    ],
  },
})
