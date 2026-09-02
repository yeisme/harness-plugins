import { defineConfig } from 'tsdown'

// 纯 ESM/Node 输出：`.（index）` 与 `./testing` 两个入口各自独立成单文件 bundle，
// 不携带任何运行时依赖，供 Web 与 TUI 以相同产物消费。
const node = {
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
} as const

export default defineConfig([
  { ...node, entry: ['lib/types/index.js'], outputOptions: { codeSplitting: false } },
  { ...node, entry: { testing: 'lib/types/testing.js' }, outputOptions: { codeSplitting: false } },
])
