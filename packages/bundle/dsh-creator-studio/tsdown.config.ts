import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
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
  clean: false,
  outputOptions: { codeSplitting: false },
} as const

export default defineConfig([
  { ...node, entry: ['lib/types/index.js'] },
  { ...node, entry: ['lib/types/contracts.js'] },
  {
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    alias: {
      '@yeisme/dsh-client-ui-creator-studio/client': fileURLToPath(new URL('../../client/ui-creator-studio/src/client.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-creator-studio': fileURLToPath(new URL('../../client/ui-creator-studio/src/index.ts', import.meta.url)),
      '@yeisme/dsh-creator-studio-host/contracts': fileURLToPath(new URL('../../host/creator-studio/src/contracts.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-pane-workbench': fileURLToPath(new URL('../../client/ui-pane-workbench/src/index.ts', import.meta.url)),
      '@yeisme/dsh-pane-protocol': fileURLToPath(new URL('../../host/pane-protocol/src/index.ts', import.meta.url)),
      // Creator Studio uses the shared preview surface only. Pointing at the
      // leaf avoids linking unrelated legacy Rich Media workbench exports.
      '@yeisme/dsh-rich-media/client': fileURLToPath(new URL('../dsh-rich-media/src/client/media-preview-pane.tsx', import.meta.url)),
    },
    deps: {
      alwaysBundle: [/^@yeisme\//u],
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-creator-studio", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
