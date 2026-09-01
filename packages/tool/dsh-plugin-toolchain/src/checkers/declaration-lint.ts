import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { report, type CheckerReport, type Finding } from '../types.js'
import { listWorkspacePackages, packageDeps, packageExports, packageName, type WorkspacePackage } from '../workspace.js'

/**
 * 声明一致性检查（G18 §2）：bundle 安装声明（cordis.patch.yml；磁盘上不存在
 * dsh.bundle.patch，2026-09-01 核验 30/30 bundle 均为双文件形态）与 package.json
 * 的三方一致性——行名必须是本包导出面、依赖行只指向本仓插件行（workspace 协议或
 * 已发布版本 pin）或不越层的外部依赖、跨包 id 唯一。
 * patch yml 语法在本仓收敛为 `- insert: [id, name]` 行，采用容错行解析器；
 * 解析不了的非注释行报红灯（fail-loud），不静默跳过。
 */
export function runDeclarationLint(root: string): CheckerReport {
  const findings: Finding[] = []
  const notes: string[] = []
  const packages = listWorkspacePackages(root)
  const bundles = packages.filter(pkg => pkg.kind === 'bundle')
  const repoPackageNames = new Set(packages.map(pkg => packageName(pkg)))
  const seenIds = new Map<string, string>()

  for (const bundle of bundles) {
    const rel = `packages/bundle/${bundle.dirName}`
    const patchPath = join(bundle.dir, 'cordis.patch.yml')
    if (!existsSync(patchPath)) {
      // preset/data bundle（无 scripts.build）无 patch 属正常，只记 note；
      // 声明了 build 的可安装 bundle 缺 patch 才是红灯。
      const hasBuild = (bundle.manifest.scripts as Record<string, unknown> | undefined)?.build !== undefined
      if (hasBuild) {
        findings.push({
          location: rel,
          code: 'DECL/PATCH_MISSING',
          message: 'installable bundle has no cordis.patch.yml',
        })
      } else {
        notes.push(`${rel}: preset/data bundle without cordis.patch.yml (record only)`)
      }
      continue
    }
    const rows = parsePatchYml(readFileSync(patchPath, 'utf8'), rel, findings)
    const name = packageName(bundle)
    const exports = packageExports(bundle)
    for (const row of rows) {
      if (row.id === undefined) {
        findings.push({ location: `${rel}/cordis.patch.yml`, line: row.lineNumber, code: 'DECL/ROW_ID_MISSING', message: 'insert row has no id' })
        continue
      }
      if (seenIds.has(row.id) && seenIds.get(row.id) !== rel) {
        findings.push({
          location: `${rel}/cordis.patch.yml`,
          line: row.lineNumber,
          code: 'DECL/ID_DUPLICATE',
          message: `insert id also declared by ${seenIds.get(row.id)}`,
        })
      } else {
        seenIds.set(row.id, rel)
      }
      if (row.name === undefined) {
        findings.push({ location: `${rel}/cordis.patch.yml`, line: row.lineNumber, code: 'DECL/ROW_NAME_MISSING', message: `row "${row.id}" has no name` })
        continue
      }
      // 行名必须命中本包根导出或子路径导出（如 @yeisme/dsh-terminal/host → ./host）。
      if (row.name !== name && !(row.name.startsWith(`${name}/`) && exports.includes(`.${row.name.slice(name.length)}`))) {
        findings.push({
          location: `${rel}/cordis.patch.yml`,
          line: row.lineNumber,
          code: 'DECL/NAME_NOT_EXPORTED',
          message: `row name is not an export of ${name} (exports: ${exports.join(', ')})`,
        })
      }
    }
    lintDependencies(bundle, rel, repoPackageNames, findings, notes)
  }

  lintLayerBoundaries(packages, findings, notes)
  if (bundles.length === 0) {
    // fail-loud：一个 bundle 都没发现说明根不对（与 bundle-contract 的 no-bundles 语义一致）。
    return {
      checker: 'declaration-lint',
      status: 'error',
      checkedCount: 0,
      findings,
      notes,
      error: 'no bundle packages discovered — wrong workspace root?',
      durationMs: 0,
    }
  }
  if (findings.length === 0) notes.push(`${bundles.length} bundles, ${seenIds.size} insert rows checked`)
  return report('declaration-lint', bundles.length, findings, notes)
}

interface PatchRow { id?: string; name?: string; lineNumber: number }

/**
 * 行级容错解析：仅接受本仓收敛语法（`- insert:` 下的 `- id:` / `name:` 行）。
 * 其他非注释非空内容一律 DECL/PATCH_UNPARSED 红灯，避免静默漏检。
 */
function parsePatchYml(text: string, rel: string, findings: Finding[]): PatchRow[] {
  const rows: PatchRow[] = []
  let current: PatchRow | undefined
  let inInsert = false
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    if (raw === undefined) continue
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    if (/^-\s*insert:?\s*$/.test(line)) {
      inInsert = true
      continue
    }
    if (!inInsert) {
      findings.push({ location: `${rel}/cordis.patch.yml`, line: index + 1, code: 'DECL/PATCH_UNPARSED', message: 'content outside insert block' })
      continue
    }
    const rowMatch = /^-\s*id:\s*(.+)$/.exec(line)
    if (rowMatch !== null) {
      current = { id: unquote(rowMatch[1] ?? ''), lineNumber: index + 1 }
      rows.push(current)
      continue
    }
    const nameMatch = /^name:\s*(.+)$/.exec(line)
    if (nameMatch !== null && current !== undefined) {
      current.name = unquote(nameMatch[1] ?? '')
      continue
    }
    if (/^-\s*\w+:/.test(line)) {
      // 另一种行键（本仓不该出现）：开新行但不识别键 → 记红灯后继续。
      current = { lineNumber: index + 1 }
      rows.push(current)
      findings.push({ location: `${rel}/cordis.patch.yml`, line: index + 1, code: 'DECL/PATCH_UNPARSED', message: 'unrecognized row key' })
      continue
    }
    findings.push({ location: `${rel}/cordis.patch.yml`, line: index + 1, code: 'DECL/PATCH_UNPARSED', message: 'unparsed line inside insert block' })
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
 * 依赖行检查：@yeisme/* 必须能解析到本仓包（workspace:* 或已发布版本 pin 均合法，
 * 非 workspace 协议记 note）；解析不到 → DECL/UNKNOWN_INTERNAL_DEP。
 */
function lintDependencies(bundle: WorkspacePackage, rel: string, repoPackageNames: Set<string>, findings: Finding[], notes: string[]): void {
  const deps = packageDeps(bundle, 'dependencies')
  for (const [depName, version] of Object.entries(deps)) {
    if (!depName.startsWith('@yeisme/')) continue
    if (!repoPackageNames.has(depName)) {
      findings.push({ location: `${rel}/package.json`, code: 'DECL/UNKNOWN_INTERNAL_DEP', message: `dependency does not resolve to a repo package: ${depName}` })
      continue
    }
    if (!version.startsWith('workspace:')) {
      notes.push(`${rel}: internal dep ${depName} pinned to published ${version}（安装行形态记录，非红灯）`)
    }
  }
}

/**
 * workspace 边界（层间依赖规则，2026-09-01 基线校准后）：
 * - host→client：红灯（Node 侧不得引浏览器面；当前 0 实例）。
 * - client→bundle / bundle→bundle：记 note——仓内既定形态（组合测试 vitest alias
 *   消费兄弟 bundle src、组装 bundle 挂其他安装行），非边界违规；G21 可再收紧。
 * client→host（类型/合同消费）与 bundle→host/client（组装）为合法方向。
 */
function lintLayerBoundaries(packages: WorkspacePackage[], findings: Finding[], notes: string[]): void {
  for (const pkg of packages) {
    const deps = { ...packageDeps(pkg, 'dependencies'), ...packageDeps(pkg, 'peerDependencies') }
    for (const [depName] of Object.entries(deps)) {
      if (!depName.startsWith('@yeisme/')) continue
      const target = packages.find(candidate => packageName(candidate) === depName)
      if (target === undefined) continue
      if (pkg.kind === 'host' && target.kind === 'client') {
        findings.push({
          location: `packages/${pkg.kind}/${pkg.dirName}/package.json`,
          code: 'DECL/LAYER_HOST_TO_CLIENT',
          message: `host package depends on client package ${depName}`,
        })
      } else if ((pkg.kind === 'client' && target.kind === 'bundle') || (pkg.kind === 'bundle' && target.kind === 'bundle')) {
        notes.push(`packages/${pkg.kind}/${pkg.dirName}: ${pkg.kind}→${target.kind} dep ${depName}（既定组合形态，记 baseline）`)
      }
    }
  }
}
