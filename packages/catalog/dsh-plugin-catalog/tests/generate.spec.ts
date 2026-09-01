import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildCatalog, discoverBundles, findWorkspaceRoot, parseInstallRows } from '../src/index.js'

/**
 * 清单生成合同（G21 §2）：
 * - 覆盖 packages/bundle 全部子目录（对当前仓库实跑对账）；
 * - 新增 bundle 后重建即自动包含（fixture 沙箱验证，无需手工登记）；
 * - 条目字段齐备（名称、描述、安装路径、依赖插件行）。
 */

// ── fixture 沙箱：最小 workspace 形态 ────────────────────────────────────────

let sandbox: string

function writeBundleFixture(root: string, dirName: string, options: {
  name?: string
  build?: boolean
  patch?: string
  dshPatchDeclared?: boolean
  deps?: Record<string, string>
  description?: string
  platform?: string
} = {}): void {
  const dir = join(root, 'packages/bundle', dirName)
  mkdirSync(dir, { recursive: true })
  const manifest: Record<string, unknown> = {
    name: options.name ?? `@yeisme/${dirName}`,
    description: options.description ?? `${dirName} fixture`,
    type: 'module',
  }
  const scripts: Record<string, string> = {}
  if (options.build === true) scripts.build = 'echo build'
  if (Object.keys(scripts).length > 0) manifest.scripts = scripts
  if (options.deps !== undefined) manifest.dependencies = options.deps
  const dsh: Record<string, unknown> = {}
  if (options.dshPatchDeclared !== false) dsh.bundle = { patch: './cordis.patch.yml' }
  if (options.platform !== undefined) dsh.client = { platform: options.platform }
  if (Object.keys(dsh).length > 0) manifest.dsh = dsh
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  if (options.patch !== undefined) {
    writeFileSync(join(dir, 'cordis.patch.yml'), options.patch, 'utf8')
  }
}

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'dsh-plugin-catalog-'))
  writeFileSync(join(sandbox, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*/*\n', 'utf8')
  writeBundleFixture(sandbox, 'dsh-demo-notes', {
    build: true,
    patch: '# demo\n- insert:\n    - id: dsh-demo-notes\n      name: \'@yeisme/dsh-demo-notes\'\n',
    deps: { '@yeisme/dsh-demo-notes-host': 'workspace:*', '@yeisme/dsh-client-ui-demo-notes': 'workspace:*', 'react': '^18.3.1' },
    platform: 'web',
  })
  writeBundleFixture(sandbox, 'dsh-demo-preset', {
    patch: '- insert:\n    - id: dsh-demo-preset\n      name: \'@yeisme/dsh-demo-preset\'\n',
  })
  writeBundleFixture(sandbox, 'dsh-demo-assembly-only', {
    build: true,
    dshPatchDeclared: false,
  })
  mkdirSync(join(sandbox, 'packages/bundle/not-a-package'), { recursive: true })
  writeFileSync(join(sandbox, 'packages/bundle/README.md'), '# bundles\n', 'utf8')
})

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

// ── 发现与条目字段 ──────────────────────────────────────────────────────────

describe('discoverBundles (fixture sandbox)', () => {
  it('catalogs every packages/bundle child directory with a manifest, and nothing else', () => {
    const entries = discoverBundles(sandbox)
    expect(entries.map(entry => entry.id)).toEqual(['dsh-demo-assembly-only', 'dsh-demo-notes', 'dsh-demo-preset'])
  })

  it('carries name, description, install path and plugin dependency rows on each entry', () => {
    const entries = discoverBundles(sandbox)
    const notes = entries.find(entry => entry.id === 'dsh-demo-notes')
    expect(notes).toBeDefined()
    expect(notes?.name).toBe('@yeisme/dsh-demo-notes')
    expect(notes?.description).toBe('dsh-demo-notes fixture')
    expect(notes?.path).toBe('packages/bundle/dsh-demo-notes')
    expect(notes?.installable).toBe(true)
    expect(notes?.preset).toBe(false)
    expect(notes?.platform).toBe('web')
    expect(notes?.patchFile).toBe('packages/bundle/dsh-demo-notes/cordis.patch.yml')
    expect(notes?.pluginDependencies).toEqual(['@yeisme/dsh-client-ui-demo-notes', '@yeisme/dsh-demo-notes-host'])
    expect(notes?.installRows).toEqual([{ id: 'dsh-demo-notes', name: '@yeisme/dsh-demo-notes' }])
  })

  it('marks preset bundles (no build script) but keeps them cataloged', () => {
    const preset = discoverBundles(sandbox).find(entry => entry.id === 'dsh-demo-preset')
    expect(preset?.preset).toBe(true)
    expect(preset?.installable).toBe(true)
    expect(preset?.installRows).toHaveLength(1)
  })

  it('marks bundles without a patch file as not installable, still listed', () => {
    const assembly = discoverBundles(sandbox).find(entry => entry.id === 'dsh-demo-assembly-only')
    expect(assembly?.installable).toBe(false)
    expect(assembly?.patchFile).toBeUndefined()
    expect(assembly?.installRows).toEqual([])
  })
})

describe('new bundle auto-inclusion (task 2.2)', () => {
  it('includes a newly added bundle directory on rebuild, without manual registration', () => {
    expect(discoverBundles(sandbox).map(entry => entry.id)).not.toContain('dsh-demo-late')
    writeBundleFixture(sandbox, 'dsh-demo-late', {
      build: true,
      patch: '- insert:\n    - id: dsh-demo-late\n      name: \'@yeisme/dsh-demo-late\'\n',
    })
    const rebuilt = buildCatalog(sandbox)
    expect(rebuilt.bundles.map(entry => entry.id)).toContain('dsh-demo-late')
    expect(rebuilt.bundleCount).toBe(4)
    expect(rebuilt.installableCount).toBe(3)
  })

  it('buildCatalog stamps schema version, generator and counts', () => {
    const catalog = buildCatalog(sandbox)
    expect(catalog.schemaVersion).toBe(1)
    expect(catalog.generator).toBe('@yeisme/dsh-plugin-catalog')
    expect(catalog.bundleCount).toBe(catalog.bundles.length)
    expect(catalog.installableCount).toBe(catalog.bundles.filter(entry => entry.installable).length)
    expect(catalog.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ── patch 行解析（与 declaration-lint 收敛语法对齐）──────────────────────────

describe('parseInstallRows', () => {
  it('parses the repo-converged insert syntax and skips comments and blanks', () => {
    const rows = parseInstallRows(['# header comment', '', '- insert:', '    - id: demo-a', "      name: '@yeisme/demo-a'", '    - id: demo-b', '      name: @yeisme/demo-b'].join('\n'))
    expect(rows).toEqual([
      { id: 'demo-a', name: '@yeisme/demo-a' },
      { id: 'demo-b', name: '@yeisme/demo-b' },
    ])
  })

  it('drops incomplete rows instead of inventing names', () => {
    expect(parseInstallRows('- insert:\n    - id: lonely\n')).toEqual([])
  })
})

// ── 真实仓库对账（对当前仓库实跑；覆盖量与 bundle-contract 量级一致）─────────

describe('real workspace catalog (integration)', () => {
  const root = findWorkspaceRoot(import.meta.dirname)

  it('covers every packages/bundle directory in this repository', () => {
    const catalog = buildCatalog(root)
    expect(catalog.bundleCount).toBeGreaterThanOrEqual(27)
    expect(new Set(catalog.bundles.map(entry => entry.id)).size).toBe(catalog.bundleCount)
    expect(new Set(catalog.bundles.map(entry => entry.name)).size).toBe(catalog.bundleCount)
    for (const entry of catalog.bundles) {
      expect(entry.path).toBe(`packages/bundle/${entry.id}`)
      expect(typeof entry.name).toBe('string')
      expect(typeof entry.description).toBe('string')
      expect(Array.isArray(entry.pluginDependencies)).toBe(true)
    }
  })

  it('parses at least one install row for every installable bundle', () => {
    const catalog = buildCatalog(root)
    for (const entry of catalog.bundles.filter(candidate => candidate.installable)) {
      expect(entry.installRows.length, entry.id).toBeGreaterThan(0)
      for (const row of entry.installRows) {
        expect(row.name).toMatch(/^@yeisme\//)
      }
    }
  })
})
