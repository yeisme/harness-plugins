import { defineConfig } from 'tsdown'

// Node 侧本地查询工具：零外部运行时依赖（只用 node: 内建）。
// 每个入口单独成配置并关闭代码分割，保证入口自包含——共享 chunk 会把
// 入口的 import.meta.url 指到 chunk 上，bin/直接执行形态即失效。
// tsc 先行作为类型门；build 尾步 lib/generate.mjs 重生成 lib/catalog.json。
const common = {
  outDir: 'lib',
  format: 'esm',
  dts: true,
  clean: false,
  outputOptions: { codeSplitting: false },
} as const

export default defineConfig([
  { ...common, entry: ['src/index.ts'], clean: true },
  { ...common, entry: ['src/cli.ts'] },
  { ...common, entry: ['src/generate.ts'] },
])
