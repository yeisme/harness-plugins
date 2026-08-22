import { defineConfig } from 'tsdown'

const node = {
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  outputOptions: { codeSplitting: false },
} as const

// Bundle the TypeScript compiler output so legacy decorators are lowered
// before Rolldown sees the entry. Bundling src/*.ts directly would publish
// raw @Remote syntax that Node cannot execute.
export default defineConfig([
  { ...node, entry: ['lib/types/index.js'] },
  { ...node, entry: ['lib/types/contracts.js'] },
])
