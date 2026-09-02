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
    alias: {
      '@yeisme/dsh-client-ui-structured-content': fileURLToPath(new URL('../ui-structured-content/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-visual-kit': fileURLToPath(new URL('../ui-visual-kit/src/index.ts', import.meta.url)),
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
      neverBundle: [...clientExternals],
      // mermaid 必须内联：DSH Web 的 ModuleLoader 只提供宿主模块，
      // profile node_modules 里的 mermaid 运行时取不到。动态 import 在
      // CJS 输出中保持懒工厂，首图才求值。
      alwaysBundle: [/^@yeisme\//u, /^mermaid(?:\/|$)/u],
    },
    outputOptions: {
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-client-ui-mermaid-render", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
