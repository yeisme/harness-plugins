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
  '@deepseek-ai/dsh-client-ui-conversation/client',
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
  {
    ...node,
    // Keep the Host face self-contained too. A local `dsh plugin add <path>`
    // can load this package without installing sibling workspace links; if the
    // host side stays external while client.js is bundled, the UI mounts but
    // `/api/toolHub/*` has no registered Remote and answers 404.
    alias: {
      // Bundle the tsc output, not the TypeScript source: Rolldown targets
      // ES2024 and otherwise preserves `@Remote`, which Node cannot parse.
      '@yeisme/dsh-tool-hub-host': fileURLToPath(new URL('../../host/dsh-tool-hub/lib/types/index.js', import.meta.url)),
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
    // workspace 包经 alias 直连源码并整体内联：ModuleLoader 单文件契约下，
    // bundle 的 client.js 不得残留对 @yeisme/* 包的外部 require。
    alias: {
      '@yeisme/dsh-client-ui-mcp-inspector/client': fileURLToPath(new URL('../../client/ui-mcp-inspector/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-mcp-inspector': fileURLToPath(new URL('../../client/ui-mcp-inspector/src/index.ts', import.meta.url)),
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
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-mcp-inspector", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
