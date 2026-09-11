import { defineConfig } from 'tsdown'
export default defineConfig([
  { entry: ['lib/types/index.js'], outDir: 'lib', format: ['esm'], platform: 'node', dts: false, clean: false, outputOptions: { entryFileNames: 'index.js' } },
  { entry: { client: 'lib/types/client/index.js' }, outDir: 'lib', format: ['cjs'], platform: 'browser', deps: { alwaysBundle: [/^@yeisme\//u], neverBundle: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'] }, dts: false, clean: false, outputOptions: { codeSplitting: false, entryFileNames: 'client.js', banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-url-session", factory: (require) => {', footer: 'return module.exports; } });', intro: 'var module = { exports: {} }; var exports = module.exports;' } },
])
