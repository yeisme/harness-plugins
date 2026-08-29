/**
 * Vitest Configuration for Command Experience Web
 *
 * Configures Testing Library with jsdom environment for React component testing.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.spec.{ts,tsx}'],
    server: {
      deps: {
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
  resolve: {
    alias: {
      '@yeisme/dsh-client-ui-command-experience-core': path.resolve(__dirname, '../command-experience-core/src/index.ts'),
    },
  },
});
