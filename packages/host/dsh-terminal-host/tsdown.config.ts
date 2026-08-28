import { defineConfig } from 'tsdown'

// Node face：入口是 tsc 已发射（装饰器已转换）的 lib/types/index.js，
// tsdown 只做单文件打包；类型直接用 tsc 的 d.ts 输出。
export default defineConfig([
  {
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    outputOptions: { codeSplitting: false },
  },
])
