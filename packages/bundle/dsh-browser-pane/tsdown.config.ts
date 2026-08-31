import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'browser',
    target: 'es2024',
    dts: false,
    clean: false,
    outputOptions: { codeSplitting: false },
  },
])
