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
  {
    ...node,
    entry: ['./src/index.ts'],
    // 与 dsh-ai-drama-director 不同：bundle 名与 host 包名不冲突，网关经
    // `@yeisme/dsh-3d-director-host` 的已构建 lib 作为普通依赖外链，无需 alias。
  },
  {
    // workspace 客户端包经 alias 直连其已构建的 rolled ESM 并整体内联：
    // ModuleLoader 单文件契约下，bundle 的 client.js 不得残留对 workspace
    // 包的外部 require；three 一并内联（ModuleLoader 取不到 profile node_modules）。
    alias: {
      '@yeisme/dsh-client-ui-3d-director': fileURLToPath(new URL('../../client/ui-3d-director/lib/index.js', import.meta.url)),
    },
    entry: { client: './src/client/index.ts' },
    define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.MODE': JSON.stringify('production') },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      alwaysBundle: [/^@yeisme\//u, /^three(\/|$)/u],
      neverBundle: [...clientExternals],
    },
    outputOptions: {
      codeSplitting: false,
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-3d-director", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
