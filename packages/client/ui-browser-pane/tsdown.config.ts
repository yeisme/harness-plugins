import { defineConfig } from 'tsdown'

export default defineConfig(['index', 'contracts'].map(name => (
  {
    entry: [`lib/types/${name}.js`],
    outDir: 'lib',
    format: ['esm'],
    platform: 'browser',
    target: 'es2024',
    dts: false,
    clean: false,
    outputOptions: { codeSplitting: false },
  }
)))
