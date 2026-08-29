import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    alias: { '@yeisme/dsh-devtools-host': fileURLToPath(new URL('../../host/dsh-devtools/lib/types/index.js', import.meta.url)) },
    entry: ['lib/types/index.js'], outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, sourcemap: true, clean: false,
    deps: { alwaysBundle: [/^@yeisme\//u], neverBundle: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-typert-protocol'] },
    outputOptions: { codeSplitting: false },
  },
  {
    alias: {
      '@yeisme/dsh-client-ui-devtools/client': fileURLToPath(new URL('../../client/ui-devtools/lib/types/client/index.js', import.meta.url)),
      '@yeisme/dsh-client-ui-devtools': fileURLToPath(new URL('../../client/ui-devtools/lib/types/index.js', import.meta.url)),
    },
    entry: { client: 'lib/types/client/index.js' }, outDir: 'lib', format: 'cjs', platform: 'browser', target: 'es2022', dts: false, sourcemap: true, clean: false,
    deps: { alwaysBundle: [/^@yeisme\//u], neverBundle: ['react', 'react/jsx-runtime', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-runtime/client', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-slots'] },
    outputOptions: { codeSplitting: false, entryFileNames: 'client.js', banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-devtools", factory: (require) => {', footer: 'return module.exports; } });', intro: 'var module = { exports: {} }; var exports = module.exports;' },
  },
])
