/**
 * Vitest configuration for the dsh-mcp-inspector bundle smoke tests.
 *
 * The client package's browser entry ships a ModuleLoader banner that
 * executes at import time, so the smoke test reaches the client source
 * through relative imports (the same pattern as the client package's own
 * tests). The banner face itself is validated by `pnpm run check:bundles`.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['./tests/**/*.spec.ts'],
  },
});
