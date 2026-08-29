import { defineConfig } from 'tsdown'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
] as const

const node = {
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  outputOptions: { codeSplitting: false },
} as const

export default defineConfig([
  { ...node },
  {
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
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-client-ui-token-usage", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
