import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'
import { inlineCssPlugin } from '../../../scripts/inline-css-plugin.mjs'

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
  { ...node, entry: ['./src/index.ts'] },
  {
    // workspace 客户端包经 alias 直连源码并整体内联：ModuleLoader 单文件
    alias: {
      '@yeisme/dsh-client-ui-ai-drama-director/client': fileURLToPath(new URL('../../client/ui-ai-drama-director/src/client/index.ts', import.meta.url)),
      '@yeisme/dsh-client-ui-creator-studio/projection-components': fileURLToPath(new URL('../../client/ui-creator-studio/src/projection-components.tsx', import.meta.url)),
      // projection-components 经 eikona-image-comparison 只用 MediaCompareRenderer。
      // rich-media 构建产物是 ModuleLoader 包装的 CJS，rolldown 无法静态解析具名导出，
      // barrel 源码又会拖入 mammoth/xlsx 等重型依赖与 process 引用，故直连渲染器模块源码。
      '@yeisme/dsh-rich-media/client': fileURLToPath(new URL('../dsh-rich-media/src/client/media-renderers.tsx', import.meta.url)),
      '@yeisme/dsh-ai-drama-director': fileURLToPath(new URL('../../host/dsh-ai-drama-director/src/index.ts', import.meta.url)),
    },
    entry: { client: './src/client/index.ts' },
    plugins: [inlineCssPlugin()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.MODE': JSON.stringify('production') },
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
