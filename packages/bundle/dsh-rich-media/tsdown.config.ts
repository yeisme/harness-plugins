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
  { ...node, entry: ['lib/types/host/types.js'] },
  {
    ...node,
    entry: { table: 'lib/types/client/table.js' },
    deps: {
      neverBundle: ['react', 'react/jsx-runtime', 'react-dom', '@tanstack/react-table', '@tanstack/react-virtual', '@yeisme/dsh-client-ui-structured-content'],
    },
  },
  {
    // workspace 包经 alias 直连源码并整体内联：ModuleLoader 单文件契约下，
    // bundle 的 client.js 不得残留对 @yeisme/* 包的外部 require。
    alias: {
      '@yeisme/dsh-client-ui-structured-content': fileURLToPath(new URL('../../client/ui-structured-content/src/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-visual-kit': fileURLToPath(new URL('../../client/ui-visual-kit/src/index.ts', import.meta.url)),
      '@yeisme/dsh-workbench-core/client': fileURLToPath(new URL('../dsh-workbench-core/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-workbench-core': fileURLToPath(new URL('../dsh-workbench-core/src/index.ts', import.meta.url)),
    },
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    // mammoth 经 package.json browser 字段声明浏览器替换（lib/unzip.js →
    // browser/unzip.js、lib/docx/files.js → browser/docx/files.js）；不启用
    // aliasFields 时 rolldown 会打进 Node 分支的 require("fs")，在 DSH
    // ModuleLoader 的 seed 表下运行时必失败。
    resolve: {
      aliasFields: [['browser']],
      mainFields: ['browser', 'module', 'main'],
    },
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      // 格式渲染器的重依赖必须内联：DSH Web 的 ModuleLoader 只提供宿主模块，
      // profile node_modules 里的包运行时取不到（同 ui-mermaid-render 的 mermaid
      // 先例）。动态 import 在 CJS 输出中保持懒工厂，首次打开对应格式才求值。
      alwaysBundle: [
        /^@yeisme\//u,
        /^@tanstack\//u,
        /^mammoth(?:\/|$)/u,
        /^@e965\/xlsx(?:\/|$)/u,
        /^dompurify(?:\/|$)/u,
      ],
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      entryFileNames: 'client.js',
      // 格式渲染器经动态 import 懒加载；inlineDynamicImports 把相对模块与
      // 重依赖全部内联成首用才求值的懒工厂，保持 client.js 单文件契约。
      inlineDynamicImports: true,
      codeSplitting: false,
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-rich-media", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
