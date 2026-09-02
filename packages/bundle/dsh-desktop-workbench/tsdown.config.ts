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

const nodeAliases = {
  '@yeisme/dsh-file-document': fileURLToPath(new URL('../dsh-file-document/src/module.ts', import.meta.url)),
  '@yeisme/dsh-file-host': fileURLToPath(new URL('../../host/dsh-file-host/src/index.ts', import.meta.url)),
  '@yeisme/dsh-file-host/node': fileURLToPath(new URL('../../host/dsh-file-host/src/node.ts', import.meta.url)),
  '@yeisme/dsh-terminal': fileURLToPath(new URL('../dsh-terminal/src/module.ts', import.meta.url)),
} as const

export default defineConfig([
  { ...node, entry: ['lib/types/index.js'], alias: nodeAliases, deps: { alwaysBundle: [/^@yeisme\/dsh-(?:file-document|file-host(?:\/node)?|terminal)$/u] } },
  {
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    dts: false,
    sourcemap: true,
    clean: false,
    alias: {
      '@yeisme/dsh-client-ui-desktop-workbench/client': fileURLToPath(new URL('../../client/ui-desktop-workbench/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-desktop-workbench': fileURLToPath(new URL('../../client/ui-desktop-workbench/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-session-tags/client': fileURLToPath(new URL('../../client/ui-session-tags/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-session-tags': fileURLToPath(new URL('../../client/ui-session-tags/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-structured-content': fileURLToPath(new URL('../../client/ui-structured-content/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-visual-kit': fileURLToPath(new URL('../../client/ui-visual-kit/src/index.ts', import.meta.url)),
      '@yeisme/dsh-workbench-core/client': fileURLToPath(new URL('../dsh-workbench-core/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-workbench-core': fileURLToPath(new URL('../dsh-workbench-core/src/index.ts', import.meta.url)),
      '@yeisme/dsh-file-document': fileURLToPath(new URL('../dsh-file-document/src/index.ts', import.meta.url)),
      '@yeisme/dsh-rich-media': fileURLToPath(new URL('../dsh-rich-media/src/index.ts', import.meta.url)),
      '@yeisme/dsh-rich-media/client': fileURLToPath(new URL('../dsh-rich-media/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-terminal': fileURLToPath(new URL('../dsh-terminal/src/index.ts', import.meta.url)),
      '@yeisme/dsh-session-manager': fileURLToPath(new URL('../../host/dsh-session-manager/src/index.ts', import.meta.url)),
      '@yeisme/dsh-file-host/node': fileURLToPath(new URL('../../host/dsh-file-host/src/node.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-pane-workbench/client': fileURLToPath(new URL('../../client/ui-pane-workbench/src/client.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-pane-workbench': fileURLToPath(new URL('../../client/ui-pane-workbench/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-pane-subagent/client': fileURLToPath(new URL('../../client/ui-pane-subagent/src/client.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-pane-subagent': fileURLToPath(new URL('../../client/ui-pane-subagent/src/index.ts', import.meta.url)),
      '@yeisme/dsh-file-host': fileURLToPath(new URL('../../host/dsh-file-host/src/index.ts', import.meta.url)),
      // Bundle the compiler output so the legacy @Remote decorators are
      // lowered before Rolldown creates the browser-side single-file bundle.
      '@yeisme/dsh-terminal-host': fileURLToPath(new URL('../../host/dsh-terminal-host/lib/types/index.js', import.meta.url)),
      '@yeisme/dsh-notify-host': fileURLToPath(new URL('../../host/dsh-notify-host/src/index.ts', import.meta.url)),
    },
    deps: {
      alwaysBundle: [/^@yeisme\//u],
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      // ModuleLoader 单文件契约：client 入口必须关闭代码切分，
      // 否则 alwaysBundle 的 @yeisme/* 会拆出 rolldown-runtime/xterm
      // 共享 chunk，浏览器侧 require("./...cjs") 命不中模块表。
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-desktop-workbench", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
