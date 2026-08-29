import { defineConfig } from 'tsdown'
import { fileURLToPath } from 'node:url'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@yeisme/dsh-workbench-core',
  '@yeisme/dsh-workbench-core/client',
  '@deepseek-ai/dsh-client-ui-primitives',
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
    alias: {
      '@yeisme/dsh-client-ui-structured-content': fileURLToPath(new URL('../ui-structured-content/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-visual-kit': fileURLToPath(new URL('../ui-visual-kit/src/index.ts', import.meta.url)),
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
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-client-ui-desktop-workbench", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
