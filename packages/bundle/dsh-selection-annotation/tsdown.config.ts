import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-runtime/client',
] as const

const node = {
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  outputOptions: { codeSplitting: false },
} as const

export default defineConfig([
  { ...node, entry: ['lib/types/index.js'] },
  {
    // workspace 客户端包经 alias 直连源码并整体内联：ModuleLoader 单文件
    // 契约下，bundle 的 client.js 不得残留对 workspace 包的外部 require。
    alias: {
      '@yeisme/dsh-client-ui-selection-annotation/client': fileURLToPath(new URL('../../client/ui-selection-annotation/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-selection-annotation': fileURLToPath(new URL('../../client/ui-selection-annotation/src/index.ts', import.meta.url)),
    },
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      // zod 随 host 合同内联；ModuleLoader 取不到 profile node_modules。
      alwaysBundle: [/^@yeisme\//u, /^zod(?:\/|$)/u],
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-selection-annotation", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
