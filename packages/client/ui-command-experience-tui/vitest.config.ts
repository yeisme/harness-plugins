import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['./tests/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@yeisme/dsh-client-ui-command-experience-core': path.resolve(__dirname, '../command-experience-core/src/index.ts'),
    },
  },
});
