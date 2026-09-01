import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runPluginChecks, summarizeExitCode } from '../src/index.js'
import { writeRunReport } from '../src/report.js'
import { runDeclarationLint } from '../src/checkers/declaration-lint.js'
import { cleanupWorkspace, makeWorkspace } from './helpers.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots) cleanupWorkspace(root)
  roots.length = 0
})

function workspace(files: Record<string, string>): string {
  const root = makeWorkspace(files)
  roots.push(root)
  return root
}

describe('runPluginChecks 统一入口', () => {
  it('isolates checker crashes as internal errors without sinking the run', async () => {
    const root = workspace({
      // 有一个干净 bundle；visual-token 因缺 surfaces 脚本报内部错误。
      'packages/bundle/fixture/package.json': JSON.stringify({ name: '@yeisme/dsh-fixture-bundle', scripts: { build: 'tsdown' }, dependencies: {} }),
    })
    const result = await runPluginChecks({ root, now: () => '2026-09-01T00:00:00.000Z' })
    expect(result.reports.find(item => item.checker === 'visual-token-conformance')?.status).toBe('error')
    expect(result.reports.find(item => item.checker === 'declaration-lint')?.status).not.toBe('error')
    expect(summarizeExitCode(result)).toBe(2)
  })

  it('baseline mode downgrades red lights to records (exit 0), gate mode exits 1', async () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': JSON.stringify({ name: '@yeisme/dsh-fixture-bundle', scripts: { build: 'tsdown' }, dependencies: {} }),
      // 缺 cordis.patch.yml → declaration-lint 红灯
    })
    const gate = await runPluginChecks({ root, only: ['declaration-lint'], now: () => '2026-09-01T00:00:00.000Z' })
    expect(summarizeExitCode(gate)).toBe(1)
    const baseline = await runPluginChecks({ root, only: ['declaration-lint'], baseline: true, now: () => '2026-09-01T00:00:00.000Z' })
    expect(summarizeExitCode(baseline)).toBe(0)
  })

  it('writes redacted repo-relative reports', async () => {
    const root = workspace({
      'packages/bundle/fixture/package.json': JSON.stringify({ name: '@yeisme/dsh-fixture-bundle', scripts: { build: 'tsdown' }, dependencies: {} }),
    })
    const result = await runPluginChecks({ root, only: ['declaration-lint'], now: () => '2026-09-01T00:00:00.000Z' })
    const reportRoot = mkdtempSync(join(tmpdir(), 'dsh-toolchain-report-'))
    roots.push(reportRoot)
    const written = await writeRunReport(result, reportRoot)
    expect(existsSync(written.jsonPath)).toBe(true)
    const markdown = readFileSync(written.mdPath, 'utf8')
    expect(markdown).toContain('# Plugin toolchain run 2026-09-01T00:00:00.000Z')
    expect(markdown).not.toContain(tmpdir())
    // JSON 报告同样只含仓库相对路径
    const json = readFileSync(written.jsonPath, 'utf8')
    expect(json).not.toContain(tmpdir())
  })
})

describe('runDeclarationLint 与真实仓无耦合', () => {
  it('reports internal error (not silent pass) on a root without bundles', () => {
    const missing = resolve(tmpdir(), 'dsh-toolchain-definitely-missing-root')
    const result = runDeclarationLint(missing)
    expect(result.status).toBe('error')
    expect(result.error).toContain('no bundle packages')
  })
})
