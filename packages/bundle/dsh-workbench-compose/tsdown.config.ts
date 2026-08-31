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
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-locale',
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

const nodeAliases = {
  '@yeisme/dsh-file-document': fileURLToPath(new URL('../dsh-file-document/src/module.ts', import.meta.url)),
  '@yeisme/dsh-terminal': fileURLToPath(new URL('../dsh-terminal/src/module.ts', import.meta.url)),
} as const

export default defineConfig([
  { ...node, entry: ['lib/types/index.js'], alias: nodeAliases, deps: { alwaysBundle: [/^@yeisme\/dsh-(?:file-document|terminal)$/u] } },
  {
    // 组合的 workspace bundle 经 alias 直连源码并整体内联：ModuleLoader
    // 单文件契约下，client.js 不得残留对 @yeisme/* 包的外部 require。
    alias: {
      '@yeisme/dsh-workbench-core/client': fileURLToPath(new URL('../dsh-workbench-core/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-workbench-core': fileURLToPath(new URL('../dsh-workbench-core/src/index.ts', import.meta.url)),
      '@yeisme/dsh-rich-media/client': fileURLToPath(new URL('../dsh-rich-media/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-rich-media': fileURLToPath(new URL('../dsh-rich-media/src/index.ts', import.meta.url)),
      '@yeisme/dsh-file-document': fileURLToPath(new URL('../dsh-file-document/src/index.ts', import.meta.url)),
      '@yeisme/dsh-terminal': fileURLToPath(new URL('../dsh-terminal/src/index.ts', import.meta.url)),
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
      alwaysBundle: [/^@yeisme\//u],
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      // alwaysBundle 引入 xterm 等重依赖时 rolldown 会拆 chunk——client 入口
      // 必须单文件，否则 ModuleLoader 取不到 rolldown-runtime 表。
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-workbench-compose", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
