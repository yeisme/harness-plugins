import { defineConfig } from 'tsdown'

// 参考插件的构建形态与 packages/bundle 层一致（ModuleLoader 单文件契约）：
// - lib/index.js：Host 面（Node/ESM，tsc 产物整体内联）；
// - lib/client.js：浏览器面（CJS 单文件，banner 注册进 window.__ModuleLoader__，
//   id 必须等于包名，不得残留对 @yeisme 工作区包或相对 chunk 的外部 require）。
// 本包零运行时依赖：三层参考面全部落在包内，无 alias、无 alwaysBundle 需求。
const clientExternals = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
] as const

const node = {
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  sourcemap: true,
  clean: false,
  outputOptions: { codeSplitting: false },
} as const

export default defineConfig([
  {
    ...node,
    // 打包 tsc 产物而非 TS 源码：与 bundle 层同因（Rolldown 直译 ESM 装饰器形态）。
    entry: ['lib/types/index.js'],
  },
  {
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    deps: {
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-plugin-example", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
