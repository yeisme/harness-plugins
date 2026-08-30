import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

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
  { ...node, entry: ['lib/types/module.js'] },
  {
    // ModuleLoader 单文件契约（V3 4.6）：client 出口为浏览器 CJS 单文件，
    // workspace 包经 alias 直连源码并整体内联，不留 @yeisme/* 外部 require。
    alias: {
      '@yeisme/dsh-client-ui-surface': fileURLToPath(new URL('../../client/ui-surface/src/index.tsx', import.meta.url)),
    },
    deps: {
      alwaysBundle: [/^@yeisme\//u],
    },
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    clean: false,
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    outputOptions: {
      entryFileNames: 'client.js',
      codeSplitting: false,
      exports: 'named',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-file-document", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
