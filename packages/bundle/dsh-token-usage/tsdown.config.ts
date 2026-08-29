import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-primitives',
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
    // Bundle the tsc output, not the TypeScript source: Rolldown targets
    // ES2024 and otherwise preserves `@Remote`, which Node cannot parse.
    alias: {
      '@yeisme/dsh-token-usage-host': fileURLToPath(new URL('../../host/dsh-token-usage/lib/types/index.js', import.meta.url)),
    },
    entry: ['lib/types/index.js'],
    deps: {
      alwaysBundle: [/^@yeisme\//u],
      // Typert decorators keep their Remote marker table in module-private
      // state. They must stay external so Host and Gateway share one runtime
      // instance; bundling a second copy makes the endpoint invisible.
      neverBundle: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-typert-protocol'],
    },
  },
  {
    // workspace 包经 alias 直连构建产物并整体内联：ModuleLoader 单文件契约下，
    // bundle 的 client.js 不得残留对 @yeisme/* 包的外部 require。
    alias: {
      '@yeisme/dsh-client-ui-token-usage/client': fileURLToPath(new URL('../../client/ui-token-usage/lib/types/client/index.js', import.meta.url)),
      '@yeisme/dsh-client-ui-token-usage': fileURLToPath(new URL('../../client/ui-token-usage/lib/types/index.js', import.meta.url)),
    },
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
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
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-token-usage", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
