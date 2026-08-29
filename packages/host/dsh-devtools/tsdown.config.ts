import { defineConfig } from 'tsdown'

export default defineConfig([{
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  sourcemap: true,
  clean: false,
  deps: { neverBundle: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-typert-protocol'] },
  outputOptions: { codeSplitting: false },
}])
