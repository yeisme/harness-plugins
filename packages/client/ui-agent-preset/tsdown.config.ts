import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/client/index.ts'
  ],
  format: 'esm',
  dts: true,
  clean: true,
  deps: {
    neverBundle: ['react', 'react-dom', '@deepseek-ai/cordis', '@deepseek-ai/dsh-*']
  }
})
