import { defineConfig } from 'tsdown'
export default defineConfig({ entry: { index: 'src/index.tsx', client: 'src/client.tsx' }, outDir: 'lib', format: 'esm', dts: true, clean: false, external: ['react','react/jsx-runtime'] })
