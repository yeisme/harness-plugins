import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    './src/index.ts',
    {
      name: 'client',
      input: './src/client/index.ts',
      output: './lib/client.js',
    },
  ],
  format: 'esm',
  dts: true,
  clean: true,
})
