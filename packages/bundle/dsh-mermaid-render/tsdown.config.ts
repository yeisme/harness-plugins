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
  {
    // workspace 客户端包经 alias 直连源码并整体内联：ModuleLoader 单文件
    // 契约下，bundle 的 client.js 不得残留对 workspace 包的外部 require。
    alias: {
      '@yeisme/dsh-client-ui-mermaid-render/client': fileURLToPath(new URL('../../client/ui-mermaid-render/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-mermaid-render': fileURLToPath(new URL('../../client/ui-mermaid-render/src/index.ts', import.meta.url)),
    },
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      // mermaid 一并内联：ModuleLoader 取不到 profile node_modules。
      alwaysBundle: [/^@yeisme\//u, 'mermaid'],
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-mermaid-render", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
