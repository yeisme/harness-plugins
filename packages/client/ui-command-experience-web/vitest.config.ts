/**
 * Vitest Configuration for Command Experience Web
 *
 * Configures Testing Library with jsdom environment for React component testing.
 */

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.spec.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^@yeisme\/dsh-client-ui-command-experience-core$/u,
        replacement: fileURLToPath(new URL('./node_modules/@yeisme/dsh-client-ui-command-experience-core/lib/index.js', import.meta.url))
      },
    ],
  },
});
