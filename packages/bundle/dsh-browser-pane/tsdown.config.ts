import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

// Resolve shared React and Host primitives through the existing ModuleLoader
// table, as the desktop bundle does. Inlining primitives duplicates the Host
// runtime and pulls its stylesheet graph into this single-file plugin.
const clientExternals = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-primitives',
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
    // ModuleLoader 单文件契约（同 dsh-file-document/browser-host 先例）：client
    // 出口为浏览器 CJS 单文件，workspace 包经 alias 直连源码并整体内联。
    alias: {
      '@yeisme/dsh-client-ui-browser-pane/contracts': fileURLToPath(new URL('../../client/ui-browser-pane/src/contracts.ts', import.meta.url)),
      '@yeisme/dsh-browser-host': fileURLToPath(new URL('../../host/dsh-browser-host/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-browser-pane': fileURLToPath(new URL('../../client/ui-browser-pane/src/index.ts', import.meta.url)),
    },
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    clean: false,
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    deps: { alwaysBundle: [/^@yeisme\//u], neverBundle: [...clientExternals] },
    outputOptions: {
      entryFileNames: 'client.js',
      codeSplitting: false,
      exports: 'named',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-browser-pane", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
