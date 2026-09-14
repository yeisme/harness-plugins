import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  // ui-primitives 由宿主 ModuleLoader 提供（内联会拖入 katex css）。
  '@deepseek-ai/dsh-client-ui-primitives',
] as const

// workspace 包经 alias 直连源码并整体内联：ModuleLoader 单文件契约下，
// bundle 的 client.js 不得残留对 @yeisme/* 包的外部 require。
export default defineConfig([
  { entry: { index: 'src/index.ts' }, outDir: 'lib', format: 'esm', dts: true, clean: false, outputOptions: { codeSplitting: false } },
  {
    alias: {
      '@yeisme/dsh-client-ui-template-registry/client': fileURLToPath(new URL('../../client/ui-template-registry/src/client.tsx', import.meta.url)),
      '@yeisme/dsh-client-ui-template-registry': fileURLToPath(new URL('../../client/ui-template-registry/src/index.tsx', import.meta.url)),
      '@yeisme/dsh-client-ui-surface': fileURLToPath(new URL('../../client/ui-surface/src/index.tsx', import.meta.url)),
      '@yeisme/dsh-template-registry': fileURLToPath(new URL('../../host/template-registry/src/index.ts', import.meta.url)),
    },
    entry: { client: 'src/client.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      alwaysBundle: [/^@yeisme\//u],
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-template-registry-bundle", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
