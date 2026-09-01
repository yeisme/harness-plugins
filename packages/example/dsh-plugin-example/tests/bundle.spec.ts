import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * BUNDLE 层合同自检（与仓库门禁同口径；本包位于 packages/example 层，
 * 不被 check:plugins 直接扫描，但作为参考插件必须满足同一合同）：
 * - cordis.patch.yml 为本仓收敛 insert 语法，行名 = 本包导出面；
 * - lib/client.js 带与包名一致的 ModuleLoader banner 注册，且自包含
 * （无 @yeisme 外部 require、无相对 chunk require）；
 * - 零运行时依赖（dependencies 为空）。
 * 依赖 build 先行（test script 已含 build）。
 */

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
  name: string
  dependencies?: Record<string, string>
  exports?: Record<string, unknown>
  dsh?: { bundle?: { patch?: string }; client?: { platform?: string; inject?: string[] } }
}

describe('package declaration (bundle layer)', () => {
  it('declares the dsh bundle patch and web client platform', () => {
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh?.client?.platform).toBe('web')
    expect(manifest.dsh?.client?.inject).toContain('@deepseek-ai/dsh-client-runtime')
  })

  it('has zero runtime dependencies (peers are optional host surfaces only)', () => {
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([])
  })
})

describe('cordis.patch.yml (repo-converged insert syntax)', () => {
  const patchText = readFileSync(join(packageDir, 'cordis.patch.yml'), 'utf8')

  it('carries exactly one insert row whose name is this package root export', () => {
    const insertIds = [...patchText.matchAll(/^\s*-\s*id:\s*(.+)$/gm)].map(match => match[1]?.trim())
    const rowNames = [...patchText.matchAll(/^\s*name:\s*(.+)$/gm)].map(match => match[1]?.trim().replace(/^['"]|['"]$/g, ''))
    expect(insertIds).toEqual(['dsh-plugin-example'])
    expect(rowNames).toEqual([manifest.name])
    expect(Object.keys(manifest.exports ?? {})).toContain('.')
  })
})

describe('built artifacts (ModuleLoader single-file contract)', () => {
  const clientPath = join(packageDir, 'lib', 'client.js')

  it('lib/client.js is built', () => {
    expect(existsSync(clientPath)).toBe(true)
  })

  it('registers via the ModuleLoader banner with the package name as id', () => {
    const source = readFileSync(clientPath, 'utf8')
    const banner = source.match(/window\.__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/)
    expect(banner?.[1]).toBe(manifest.name)
  })

  it('keeps client.js self-contained: no @yeisme or relative chunk requires', () => {
    const source = readFileSync(clientPath, 'utf8')
    expect(source.match(/require\("@yeisme\/[^"]+"\)/g)).toBeNull()
    expect(source.match(/require\("\.\/[^"]+"\)/g)).toBeNull()
  })

  it('builds the host face as the root entry', () => {
    expect(existsSync(join(packageDir, 'lib', 'index.js'))).toBe(true)
  })
})
