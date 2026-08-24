import { defineConfig } from 'tsdown';

export default defineConfig({
  format: 'esm',
  dts: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-*',
    '@yeisme/dsh-*',
  ],
  compilerOptions: {
    jsx: 'react-jsx',
    jsxImportSource: 'react',
  },
});
