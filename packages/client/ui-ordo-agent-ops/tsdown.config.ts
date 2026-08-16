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

/**
 * 旧 leaf 仍需有一个 DSH 可发现的 browser entry；它只 bundle 到统一包的
 * applyLegacyClient，不保留第二份 slot 或 panel 实现。
 */
export default defineConfig({
  entry: { client: 'lib/types/client/index.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: [...clientExternals],
    // 旧 browser leaf 不能要求 DSH 再解析一个 node package；把统一运行时
    // 直接编入 legacy factory，仍由它自己的 client entry 承担发现职责。
    alwaysBundle: [
      '@yeisme/dsh-ordo-agent-ops',
      '@yeisme/dsh-ordo-agent-ops/**',
    ],
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-client-ui-ordo-agent-ops", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
