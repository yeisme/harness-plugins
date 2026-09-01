import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'

/** 包层：与 packages/ 一级目录对应的形态学分类 */
export type PackageKind =
  | 'bundle'
  | 'host'
  | 'client'
  | 'sdk'
  | 'tool'
  | 'catalog'
  | 'example'
  | 'preset'

export interface WorkspacePackage {
  kind: PackageKind
  /** packages/<kind>/<dir> 的目录名 */
  dirName: string
  dir: string
  manifest: Record<string, unknown>
}

/** 从任一起点向上找 pnpm-workspace.yaml 所在的仓库根 */
export function findWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir)
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current
    const parent = dirname(current)
    if (parent === current) throw new Error(`no pnpm-workspace.yaml ancestor for ${startDir}`)
    current = parent
  }
}

const KINDS: PackageKind[] = ['bundle', 'host', 'client', 'sdk', 'tool', 'catalog', 'example', 'preset']

/** 发现 packages 下各层目录中全部带 package.json 的包 */
export function listWorkspacePackages(root: string): WorkspacePackage[] {
  const out: WorkspacePackage[] = []
  for (const kind of KINDS) {
    const base = resolve(root, 'packages', kind)
    if (!existsSync(base)) continue
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = resolve(base, entry.name)
      const manifestPath = join(dir, 'package.json')
      if (!existsSync(manifestPath)) continue
      out.push({
        kind,
        dirName: entry.name,
        dir,
        manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>,
      })
    }
  }
  return out.sort((a, b) => (a.kind + a.dirName < b.kind + b.dirName ? -1 : 1))
}

export function packageName(pkg: WorkspacePackage): string {
  return String(pkg.manifest.name ?? `packages/${pkg.kind}/${pkg.dirName}`)
}

export function packageDeps(pkg: WorkspacePackage, field: 'dependencies' | 'peerDependencies' | 'devDependencies'): Record<string, string> {
  const value = pkg.manifest[field]
  return value !== undefined && typeof value === 'object' && value !== null
    ? (value as Record<string, string>)
    : {}
}

export function packageExports(pkg: WorkspacePackage): string[] {
  const value = pkg.manifest.exports
  if (value === undefined) return ['.']
  if (typeof value === 'string') return ['.']
  return Object.keys(value as Record<string, unknown>)
}

/** 递归收集包内源码文件（ts/tsx），只读 inspect */
export function sourceFiles(dir: string, extensions: readonly string[] = ['.ts', '.tsx']): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path, extensions)
    return extensions.includes(extnameOf(entry.name)) ? [path] : []
  })
}

function extnameOf(name: string): string {
  const index = name.lastIndexOf('.')
  return index === -1 ? '' : name.slice(index)
}

/** 逐行读取并剥离注释行（供静态扫描降低文档/注释噪音） */
export function readCodeLines(path: string): Array<{ line: number; text: string }> {
  const raw = readFileSync(path, 'utf8').split('\n')
  const out: Array<{ line: number; text: string }> = []
  let inBlockComment = false
  for (let index = 0; index < raw.length; index += 1) {
    const original = raw[index] ?? ''
    let text = original
    if (inBlockComment) {
      const end = text.indexOf('*/')
      if (end === -1) continue
      text = text.slice(end + 2)
      inBlockComment = false
    }
    const blockStart = text.indexOf('/*')
    if (blockStart !== -1) {
      const rest = text.slice(blockStart + 2)
      if (!rest.includes('*/')) {
        inBlockComment = true
        text = text.slice(0, blockStart)
      } else {
        const after = text.slice(text.indexOf('*/', blockStart) + 2)
        text = text.slice(0, blockStart) + after
      }
    }
    if (/^\s*(?:\/\/|\*)/.test(text)) continue
    out.push({ line: index + 1, text })
  }
  return out
}
