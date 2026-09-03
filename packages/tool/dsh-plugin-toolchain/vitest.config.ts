import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// vitest 解析 SDK 源码而非 lib 产物：并发测试相位里其它包的
// `--filter @yeisme/dsh-plugin-contracts run build` 会瞬时清空 lib，
// 产物解析在整仓并行 test 下存在窗口期竞态；工具测试不验 SDK 打包。
export default defineConfig({
  resolve: {
    alias: {
      '@yeisme/dsh-plugin-contracts': resolve(__dirname, '../../sdk/dsh-plugin-contracts/src/index.ts'),
    },
  },
})
