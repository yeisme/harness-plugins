import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
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
  clean: false,
  outputOptions: { codeSplitting: false },
} as const

export default defineConfig([
  { ...node, entry: ['lib/types/index.js'] },
  { ...node, entry: ['lib/types/host/types.js'] },
  {
    // workspace 包经 alias 直连源码并整体内联：ModuleLoader 单文件契约下，
    // bundle 的 client.js 不得残留对 @yeisme/* 包的外部 require。
    alias: {
      '@yeisme/dsh-workbench-core/client': fileURLToPath(new URL('../dsh-workbench-core/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-workbench-core': fileURLToPath(new URL('../dsh-workbench-core/src/index.ts', import.meta.url)),
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
      alwaysBundle: [/^@yeisme\//u],
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-rich-media", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
