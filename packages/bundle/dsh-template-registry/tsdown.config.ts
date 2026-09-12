import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'
const client = fileURLToPath(new URL('../../client/ui-template-registry/src/client.tsx', import.meta.url))
export default defineConfig([
 { entry: { index: 'src/index.ts' }, outDir: 'lib', format: 'esm', dts: true, clean: false },
 { entry: { client }, outDir: 'lib', format: 'cjs', dts: false, clean: false,
   alias: { '@yeisme/dsh-client-ui-template-registry': fileURLToPath(new URL('../../client/ui-template-registry/src/index.tsx', import.meta.url)) },
   deps: { alwaysBundle: [/^@yeisme\//u], neverBundle: ['react','react/jsx-runtime'] },
   outputOptions: { codeSplitting: false, entryFileNames: 'client.js', banner: 'window.__ModuleLoader__.load({ id: "@yeisme/dsh-template-registry-bundle", factory: (require) => {', footer: 'return module.exports; } });', intro: 'var module = { exports: {} }; var exports = module.exports;' } },
])
