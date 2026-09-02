import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'
import { report, type CheckerReport, type Finding } from '../types.js'
import { listWorkspacePackages, readCodeLines, sourceFiles, type WorkspacePackage } from '../workspace.js'

/**
 * 投影面安全审计（G18 §3，R9 观测门）：静态扫描 host→client 导出面与 wire fixture。
 * 仓库红线：host 边界只向浏览器传 safe projection——不传 cookie/token/raw URL/
 * 绝对路径/任意 fetch。本检查器是观测门而非证明器：命中只报告形状定位
 * （文件:行 + 规则码），绝不回显字段值；红灯=需要 owner 复核的观测点，
 * 首跑允许既有红灯（基线），清零归 G21。
 *
 * 三个扫描面：
 * 1) 浏览器侧直接访问（client/bundle src）：document.cookie、storage、裸 fetch、
 *    绝对路径字面量、非本地 raw URL 字面量；
 * 2) host 投影形状（host src 的 interface/type 字段名）：敏感命名字段进入导出类型；
 * 3) wire fixture（fixtures/ 与 *.fixture.*）：值形态含敏感键/绝对路径/URL。
 */
export function runSafeProjectionAudit(root: string): CheckerReport {
  const findings: Finding[] = []
  const notes: string[] = []
  const packages = listWorkspacePackages(root)
  let checkedFiles = 0
  let checkedFixtures = 0

  for (const pkg of packages) {
    if (pkg.kind === 'client' || pkg.kind === 'bundle') {
      for (const file of sourceFiles(join(pkg.dir, 'src'))) {
        checkedFiles += 1
        const rel = relative(root, file)
        const source = readFileSync(file, 'utf8')
        const ownerAuthorizedUrlSource = source.includes('SAFEPROJ: owner-authorized URL source')
        for (const { line, text } of readCodeLines(file)) {
          auditBrowserLine(rel, line, text, findings, ownerAuthorizedUrlSource)
        }
      }
    }
    if (pkg.kind === 'host') {
      for (const file of sourceFiles(join(pkg.dir, 'src'))) {
        checkedFiles += 1
        auditProjectionShapes(pkg, root, file, findings)
      }
    }
    for (const fixture of fixtureFiles(pkg)) {
      checkedFixtures += 1
      auditFixture(pkg, root, fixture, findings)
    }
  }

  notes.push(`${checkedFiles} source files, ${checkedFixtures} wire fixtures scanned (observation gate; findings need owner review)`)
  return report('safe-projection-audit', checkedFiles + checkedFixtures, findings, notes)
}

/** 浏览器侧红线访问——只记定位与规则，不回显命中文本 */
function auditBrowserLine(rel: string, line: number, text: string, findings: Finding[], ownerAuthorizedUrlSource = false): void {
  if (/\bdocument\s*\.\s*cookie\b/.test(text)) {
    findings.push({ location: rel, line, code: 'SAFEPROJ/BROWSER_COOKIE_ACCESS', message: 'direct document.cookie access on browser side' })
  }
  if (/\b(?:localStorage|sessionStorage)\b/.test(text)) {
    findings.push({ location: rel, line, code: 'SAFEPROJ/BROWSER_STORAGE_ACCESS', message: 'direct browser storage access' })
  }
  if (/\bfetch\s*\(/.test(text) && !ownerAuthorizedUrlSource) {
    findings.push({ location: rel, line, code: 'SAFEPROJ/RAW_FETCH', message: 'fetch call on browser side (owner seam required)' })
  }
  if (/(?<![\w:])\/(?:home|Users|workspaces|var|tmp|root|etc)\/[^\s'"`]*['"`]/.test(text)) {
    findings.push({ location: rel, line, code: 'SAFEPROJ/ABSOLUTE_PATH_LITERAL', message: 'absolute filesystem path literal' })
  }
  if (/https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[\w.-]+\//.test(text)) {
    findings.push({ location: rel, line, code: 'SAFEPROJ/RAW_URL_LITERAL', message: 'non-local URL literal (raw URL projection risk)' })
  }
}

const SENSITIVE_FIELD = /^(?:cookie|token|secret|password|authorization|bearer|credential|apikey|api_key)$/i

/** host 导出类型中的敏感命名字段：进入投影形状即记观测点 */
function auditProjectionShapes(pkg: WorkspacePackage, root: string, file: string, findings: Finding[]): void {
  const rel = relative(root, file)
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  const exported = /export\s+(?:interface|type)\s+(\w+)/
  let inExportedType = false
  let depth = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined) continue
    const decl = exported.exec(line)
    if (decl !== null) {
      inExportedType = true
      depth = 0
    }
    if (inExportedType) {
      depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
      if (depth <= 0 && line.includes('}')) inExportedType = false
      const field = /^\s*(?:readonly\s+)?([A-Za-z_][\w]*)\s*\??\s*:/.exec(line)
      if (field !== null && SENSITIVE_FIELD.test(field[1] ?? '')) {
        findings.push({
          location: rel,
          line: index + 1,
          code: 'SAFEPROJ/PROJECTION_FIELD',
          message: `exported projection field named "${field[1]}" in host package ${pkg.dirName} — owner review required`,
        })
      }
    }
  }
}

function fixtureFiles(pkg: WorkspacePackage): string[] {
  const out: string[] = []
  for (const file of sourceFiles(join(pkg.dir, 'tests'), ['.ts', '.tsx', '.json'])) {
    if (file.includes('fixtures') || file.includes('.fixture.')) out.push(file)
  }
  const fixtureDir = join(pkg.dir, 'fixtures')
  out.push(...sourceFiles(fixtureDir, ['.ts', '.tsx', '.json']))
  return out
}

function auditFixture(pkg: WorkspacePackage, root: string, file: string, findings: Finding[]): void {
  const rel = relative(root, file)
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined) continue
    const key = /['"]?([\w-]*(?:cookie|token|secret|password|authorization|credential)[\w-]*)['"]?\s*[:=]/i.exec(line)
    if (key !== null) {
      findings.push({
        location: rel,
        line: index + 1,
        code: 'SAFEPROJ/WIRE_FIXTURE_KEY',
        message: `wire fixture key matching sensitive naming in ${pkg.dirName} — verify value is shape-only/redacted`,
      })
    }
    if (/(?<![\w:])\/(?:home|Users|workspaces|var|tmp|root|etc)\/[^\s'"`]*['"`]/.test(line)) {
      findings.push({ location: rel, line: index + 1, code: 'SAFEPROJ/WIRE_FIXTURE_ABS_PATH', message: 'wire fixture contains absolute filesystem path' })
    }
  }
}
