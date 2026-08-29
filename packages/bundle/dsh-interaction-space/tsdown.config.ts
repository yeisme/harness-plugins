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
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  outputOptions: { codeSplitting: false },
} as const

export default defineConfig([
  {
    ...node,
    entry: ['lib/types/index.js'],
  },
  {
    // workspace 包经 alias 直连构建产物并整体内联：ModuleLoader 单文件契约下，
    // bundle 的 client.js 不得残留对 @yeisme/* 包的外部 require。
    alias: {
      '@yeisme/dsh-client-ui-interaction-space/client': fileURLToPath(new URL('../../client/ui-interaction-space/lib/types/client/index.js', import.meta.url)),
      '@yeisme/dsh-client-ui-interaction-space': fileURLToPath(new URL('../../client/ui-interaction-space/lib/types/index.js', import.meta.url)),
      '@yeisme/dsh-client-ui-surface': fileURLToPath(new URL('../../client/ui-surface/lib/index.mjs', import.meta.url)),
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
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-interaction-space", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
