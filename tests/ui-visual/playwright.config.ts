import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

const evidenceDir = process.env.UI_VISUAL_EVIDENCE_DIR ?? resolve('temp/ui-visual-playwright')

export default defineConfig({
  testDir: '.',
  testMatch: 'visual.spec.ts',
  timeout: 30_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: 'disabled' } },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
  outputDir: resolve(evidenceDir, 'playwright'),
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4178',
    browserName: 'chromium',
    colorScheme: 'dark',
    locale: 'en-US',
    reducedMotion: 'reduce',
    viewport: { width: 1200, height: 900 },
  },
  webServer: {
    command: 'node tests/ui-visual/server.mjs',
    cwd: resolve('.'),
    url: 'http://127.0.0.1:4178/health',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
