import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

/** 在临时目录搭一个最小 workspace（packages/<kind>/<dir>/...），返回根路径 */
export function makeWorkspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-toolchain-'))
  writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*/*\n')
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
  return root
}

export function cleanupWorkspace(root: string): void {
  rmSync(root, { recursive: true, force: true })
}

export function bundlePackageJson(options: {
  name?: string
  deps?: Record<string, string>
  scripts?: Record<string, string>
  exports?: string[]
}): string {
  return JSON.stringify(
    {
      name: options.name ?? '@yeisme/dsh-fixture-bundle',
      type: 'module',
      scripts: options.scripts ?? { build: 'tsdown' },
      exports: Object.fromEntries((options.exports ?? ['.', './client', './cordis.patch.yml', './package.json']).map(key => [key, './lib/x.js'])),
      dependencies: options.deps ?? {},
    },
    null,
    2,
  )
}
