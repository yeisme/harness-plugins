import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findBundle, loadCatalog, renderBundleDetail, renderBundleTable, searchBundles, serializeCatalog, type PluginCatalog } from '../src/index.js'

/**
 * 查询 CLI 的纯逻辑面（渲染与匹配）；进程级入口（bin/scripts）由
 * scoped 验证实跑覆盖。清单 fixture 只含脱敏的形状数据。
 */

let workDir: string
let catalog: PluginCatalog

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'dsh-plugin-catalog-cli-'))
  catalog = {
    schemaVersion: 1,
    generator: '@yeisme/dsh-plugin-catalog',
    generatedAt: '2026-09-01T00:00:00.000Z',
    bundleCount: 3,
    installableCount: 2,
    bundles: [
      {
        id: 'dsh-demo-notes',
        name: '@yeisme/dsh-demo-notes',
        description: 'demo notes bundle',
        path: 'packages/bundle/dsh-demo-notes',
        installable: true,
        preset: false,
        platform: 'web',
        patchFile: 'packages/bundle/dsh-demo-notes/cordis.patch.yml',
        pluginDependencies: ['@yeisme/dsh-demo-notes-host'],
        installRows: [{ id: 'dsh-demo-notes', name: '@yeisme/dsh-demo-notes' }],
      },
      {
        id: 'dsh-demo-preset',
        name: '@yeisme/dsh-demo-preset',
        description: 'demo preset data',
        path: 'packages/bundle/dsh-demo-preset',
        installable: true,
        preset: true,
        pluginDependencies: [],
        installRows: [{ id: 'dsh-demo-preset', name: '@yeisme/dsh-demo-preset' }],
      },
      {
        id: 'dsh-demo-assembly-only',
        name: '@yeisme/dsh-demo-assembly-only',
        description: 'assembly surface without standalone install row',
        path: 'packages/bundle/dsh-demo-assembly-only',
        installable: false,
        preset: false,
        pluginDependencies: [],
        installRows: [],
      },
    ],
  }
})

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('findBundle', () => {
  it('matches by directory id', () => {
    expect(findBundle(catalog, 'dsh-demo-notes')?.name).toBe('@yeisme/dsh-demo-notes')
  })

  it('matches by package name', () => {
    expect(findBundle(catalog, '@yeisme/dsh-demo-preset')?.id).toBe('dsh-demo-preset')
  })

  it('returns undefined for unknown selectors', () => {
    expect(findBundle(catalog, 'nope')).toBeUndefined()
  })
})

describe('searchBundles', () => {
  it('searches case-insensitively over description', () => {
    expect(searchBundles(catalog, 'PRESET').map(entry => entry.id)).toEqual(['dsh-demo-preset'])
  })

  it('searches over plugin dependency rows', () => {
    expect(searchBundles(catalog, 'demo-notes-host').map(entry => entry.id)).toEqual(['dsh-demo-notes'])
  })

  it('returns empty for no match', () => {
    expect(searchBundles(catalog, 'zzz')).toEqual([])
  })
})

describe('renderers', () => {
  it('renders a stable table with a header row, preserving the given order', () => {
    const table = renderBundleTable(catalog.bundles)
    const lines = table.split('\n')
    expect(lines[0]).toContain('ID')
    expect(lines[0]).toContain('INSTALLABLE')
    expect(lines).toHaveLength(4)
    expect(lines[1]?.startsWith('dsh-demo-notes')).toBe(true)
    expect(lines[3]?.startsWith('dsh-demo-assembly-only')).toBe(true)
  })

  it('truncates long descriptions with an ellipsis character', () => {
    const table = renderBundleTable([{ ...catalog.bundles[0]!, description: 'x'.repeat(200) }])
    expect(table.split('\n')[1]?.length).toBeLessThan(200)
  })

  it('renders per-entry detail with install path, deps and rows', () => {
    const detail = renderBundleDetail(catalog.bundles[0]!)
    expect(detail).toContain('install path: packages/bundle/dsh-demo-notes')
    expect(detail).toContain('installable:  yes')
    expect(detail).toContain('- @yeisme/dsh-demo-notes-host')
    expect(detail).toContain('- id dsh-demo-notes name @yeisme/dsh-demo-notes')
  })

  it('explains non-installable entries in the detail rendering', () => {
    const detail = renderBundleDetail(catalog.bundles[2]!)
    expect(detail).toContain('installable:  no')
  })
})

describe('loadCatalog', () => {
  it('round-trips a serialized manifest', () => {
    const path = join(workDir, 'catalog.json')
    writeFileSync(path, serializeCatalog(catalog), 'utf8')
    expect(loadCatalog(path)).toEqual(catalog)
  })

  it('rejects a schema mismatch loudly', () => {
    const path = join(workDir, 'bad.json')
    writeFileSync(path, JSON.stringify({ schemaVersion: 99, bundles: [] }), 'utf8')
    expect(() => loadCatalog(path)).toThrow(/schema mismatch/)
  })

  it('reports a missing manifest with a regenerate hint', () => {
    expect(() => loadCatalog(join(workDir, 'absent.json'))).toThrow(/run the build/)
  })
})

describe('serializeCatalog', () => {
  it('is stable apart from the timestamp field', () => {
    const first = buildCatalogRoundTrip()
    const second = buildCatalogRoundTrip()
    expect(first.replace(/"generatedAt": "[^"]+"/, '')).toBe(second.replace(/"generatedAt": "[^"]+"/, ''))
  })
})

function buildCatalogRoundTrip(): string {
  return serializeCatalog({ ...catalog, bundles: [...catalog.bundles].sort((a, b) => (a.id < b.id ? -1 : 1)) })
}
