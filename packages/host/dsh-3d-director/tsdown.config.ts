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

// Bundle the TypeScript compiler output so decorators (@Remote) are lowered
// before Rolldown sees the entry (same rationale as packages/host/creator-studio).
export default defineConfig([{ ...node, entry: ['lib/types/index.js'] }])
