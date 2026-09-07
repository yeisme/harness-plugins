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
    server: {
      deps: {
        // dsh-client-ui-primitives 的 MarkdownText 引入 katex css；inline 后
        // 由 vitest 转换并吞掉 css import，Node ESM 不再直撞 .css。
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
});
