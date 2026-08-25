import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const clientExternals = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
] as const

const node = {
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: true,
  clean: true,
  outputOptions: { codeSplitting: false },
} as const

export default defineConfig([
  { ...node, entry: ['./src/index.ts'] },
  {
    // workspace 客户端包经 alias 直连源码并整体内联：ModuleLoader 单文件
    alias: {
      '@yeisme/dsh-client-ui-ai-drama-director/client': fileURLToPath(new URL('../../client/ui-ai-drama-director/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-ai-drama-director': fileURLToPath(new URL('../../host/dsh-ai-drama-director/src/index.ts', import.meta.url)),
    },
    entry: { client: './src/client/index.ts' },
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
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-ai-drama-director", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
