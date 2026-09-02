/**
 * 仓库包发现：只读扫描 packages/bundle 目录，生成清单条目。
 *
 * 与 packages/tool/dsh-plugin-toolchain 的 workspace 发现保持同一层语义
 * （packages 一级目录 = 层），但本包只需要 bundle 层的窄视图，不复制检查器
 * 的完整 workspace 模型；patch 行解析只接受本仓收敛语法（`- insert:` 下的
 * `- id:` / `name:` 行）。解析不了的行静默跳过——catalog 是查询工具，
 * 红灯归 declaration-lint 所有；测试以真实仓库对账防止两套解析漂移。
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import type { CatalogBundleEntry, CatalogInstallRow, CatalogPersonalCodingPackV1 } from './schema.js'

/** 从任一起点向上找 pnpm-workspace.yaml 所在的仓库根（与 toolchain 同语义）。 */
export function findWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir)
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current
    const parent = dirname(current)
    if (parent === current) throw new Error(`no pnpm-workspace.yaml ancestor for ${startDir}`)
    current = parent
  }
}

/** patch 文件名约定：本仓 2026-09-01 核验全部 bundle 为双文件形态。 */
const PATCH_FILE = 'cordis.patch.yml'

/** 摘要拼接上限：清单里的 description 不做截断，展示层自行处理。 */
function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim() === '')) return undefined
  return value as string[]
}

function toPosix(path: string): string {
  return path.split('\\').join('/')
}

/**
 * 解析 cordis.patch.yml 的 insert 安装行（本仓收敛语法）。
 * 注释与空行跳过；只回收 id 与 name 都齐的完整行；其余行不是本工具的
 * 红灯对象（见文件头注释的职责边界）。
 */
export function parseInstallRows(text: string): CatalogInstallRow[] {
  const rows: CatalogInstallRow[] = []
  let current: { id?: string; name?: string } | undefined
  let inInsert = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    if (/^-\s*insert:?\s*$/.test(line)) {
      inInsert = true
      continue
    }
    if (!inInsert) continue
    const idMatch = /^-\s*id:\s*(.+)$/.exec(line)
    if (idMatch !== null) {
      current = { id: unquote(idMatch[1] ?? '') }
      continue
    }
    const nameMatch = /^name:\s*(.+)$/.exec(line)
    if (nameMatch !== null && current !== undefined) {
      const id = current.id
      const name = unquote(nameMatch[1] ?? '')
      if (id !== undefined && id !== '' && name !== '') rows.push({ id, name })
      current = undefined
      continue
    }
    if (/^-\s*\w+:/.test(line)) current = {}
  }
  return rows
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"')))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/**
 * 发现 packages/bundle 下全部 bundle 目录并生成清单条目（按 id 排序）。
 * 新增 bundle 目录后重新调用即包含，无需任何手工登记。
 */
export function discoverBundles(root: string): CatalogBundleEntry[] {
  const bundlesRoot = resolve(root, 'packages/bundle')
  if (!existsSync(bundlesRoot)) {
    throw new Error('no packages/bundle directory under workspace root — run from the harness-plugins checkout')
  }
  const entries: CatalogBundleEntry[] = []
  for (const dirent of readdirSync(bundlesRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue
    const dir = join(bundlesRoot, dirent.name)
    const manifestPath = join(dir, 'package.json')
    if (!existsSync(manifestPath)) continue
    entries.push(readBundleEntry(root, dirent.name, dir, manifestPath))
  }
  return entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function readBundleEntry(root: string, dirName: string, dir: string, manifestPath: string): CatalogBundleEntry {
  const manifest = readRecord(JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown)
  const name = readString(manifest.name) ?? `packages/bundle/${dirName}`
  const description = readString(manifest.description) ?? ''
  const hasBuild = readString(readRecord(manifest.scripts).build) !== undefined

  const dshClient = readRecord(readRecord(manifest.dsh).client)
  // 与 dsh:dev 的 isBundleManifest 同语义：dsh.bundle.patch 必须是非空字符串。
  const declaredPatch = readString(readRecord(readRecord(manifest.dsh).bundle).patch)
  const patchDeclared = declaredPatch !== undefined && declaredPatch.trim() !== ''
  const patchPath = join(dir, PATCH_FILE)
  const patchExists = existsSync(patchPath)
  const installable = patchDeclared && patchExists

  const pluginDependencies = Object.keys(readRecord(manifest.dependencies))
    .filter(depName => depName.startsWith('@yeisme/'))
    .sort()

  const platform = readString(dshClient.platform)
  const sourcePath = toPosix(relative(root, dir))
  const personalCoding = readPersonalCodingPack(readRecord(readRecord(manifest.dsh).personalCoding), sourcePath, manifest)
  return {
    id: dirName,
    name,
    description,
    path: sourcePath,
    installable,
    preset: !hasBuild,
    ...(platform !== undefined ? { platform } : {}),
    ...(installable ? { patchFile: toPosix(relative(root, patchPath)) } : {}),
    pluginDependencies,
    installRows: patchExists ? parseInstallRows(readFileSync(patchPath, 'utf8')) : [],
    ...(personalCoding !== undefined ? { personalCoding } : {}),
  }
}

function readPersonalCodingPack(input: Record<string, unknown>, sourcePath: string, manifest: Record<string, unknown>): CatalogPersonalCodingPackV1 | undefined {
  if (Object.keys(input).length === 0) return undefined
  const packId = readString(input.packId)
  const tier = readString(input.tier)
  const critical = readBoolean(input.critical)
  const dependencies = readStringArray(input.dependencies)
  const criticalContributions = readStringArray(input.criticalContributions)
  const optionalContributions = readStringArray(input.optionalContributions)
  if (packId === undefined || !/^[a-z0-9][a-z0-9-]*$/.test(packId) || (tier !== 'base' && tier !== 'optional') || critical === undefined || dependencies === undefined || criticalContributions === undefined || optionalContributions === undefined) {
    throw new Error(`invalid dsh.personalCoding metadata in ${readString(manifest.name) ?? sourcePath}`)
  }
  return { packId, tier, critical, dependencies, criticalContributions, optionalContributions, sourcePath }
}
