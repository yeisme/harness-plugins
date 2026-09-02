import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'neutral',
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    outputOptions: { codeSplitting: false },
  },
])
