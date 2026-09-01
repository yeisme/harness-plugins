#!/usr/bin/env node
/**
 * 本地查询 CLI（bin: dsh-plugin-catalog；scripts 入口：pnpm catalog）。
 *
 * 用法：
 *   dsh-plugin-catalog list [--json] [--manifest <path>]
 *   dsh-plugin-catalog show <id-or-package-name> [--json] [--manifest <path>]
 *   dsh-plugin-catalog search <term> [--json] [--manifest <path>]
 *   dsh-plugin-catalog generate [--root <dir>] [--out <path>]
 *
 * 只读本地静态清单；无网络、无遥测。默认清单 = 本包 lib/catalog.json
 * （`pnpm --filter @yeisme/dsh-plugin-catalog run build` 重新生成）。
 * 退出码：0 成功；1 查询目标不存在；2 用法/输入错误。
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { main as generateMain } from './generate.js'
import { defaultManifestPath } from './generate.js'
import type { CatalogBundleEntry, PluginCatalog } from './schema.js'

export function loadCatalog(manifestPath: string): PluginCatalog {
  if (!existsSync(manifestPath)) {
    throw new Error(`catalog manifest not found: ${manifestPath} — run the build (or the generate command) first`)
  }
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as Partial<PluginCatalog>
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.bundles)) {
    throw new Error(`catalog manifest schema mismatch: ${manifestPath} (expected schemaVersion 1 with bundles array)`)
  }
  return parsed as PluginCatalog
}

/** 按 id 或包名精确匹配；找不到返回 undefined。 */
export function findBundle(catalog: PluginCatalog, selector: string): CatalogBundleEntry | undefined {
  return catalog.bundles.find(entry => entry.id === selector || entry.name === selector)
}

/** 子串搜索（大小写不敏感；覆盖 id、包名、描述与依赖插件行）。 */
export function searchBundles(catalog: PluginCatalog, term: string): CatalogBundleEntry[] {
  const needle = term.toLowerCase()
  return catalog.bundles.filter(entry =>
    [entry.id, entry.name, entry.description, ...entry.pluginDependencies, ...entry.installRows.map(row => `${row.id} ${row.name}`)]
      .some(field => field.toLowerCase().includes(needle)),
  )
}

const LIST_COLUMNS: Array<{ label: string; width: number }> = [
  { label: 'ID', width: 28 },
  { label: 'INSTALLABLE', width: 13 },
  { label: 'PLATFORM', width: 9 },
  { label: 'PACKAGE', width: 42 },
]

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${' '.repeat(width - value.length)}`
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 1))}…`
}

/** list/search 共用的表格式人类可读渲染（描述截断到 60 列）。 */
export function renderBundleTable(entries: readonly CatalogBundleEntry[]): string {
  const header = LIST_COLUMNS.map(column => pad(column.label, column.width)).join('  ') + '  DESCRIPTION'
  const lines = entries.map(entry =>
    [
      pad(entry.id, LIST_COLUMNS[0]?.width ?? 0),
      pad(entry.installable ? 'yes' : 'no', LIST_COLUMNS[1]?.width ?? 0),
      pad(entry.platform ?? '-', LIST_COLUMNS[2]?.width ?? 0),
      pad(entry.name, LIST_COLUMNS[3]?.width ?? 0),
      truncate(entry.description, 60),
    ].join('  ').trimEnd(),
  )
  return [header, ...lines].join('\n')
}

/** show 用的单条目详情渲染。 */
export function renderBundleDetail(entry: CatalogBundleEntry): string {
  const lines = [
    `id:           ${entry.id}`,
    `package:      ${entry.name}`,
    `description:  ${entry.description}`,
    `install path: ${entry.path}`,
    `installable:  ${entry.installable ? 'yes' : 'no (no cordis.patch.yml or no dsh.bundle.patch declaration)'}`,
    `preset:       ${entry.preset ? 'yes (no build artifacts)' : 'no'}`,
    `platform:     ${entry.platform ?? '-'}`,
    `patch file:   ${entry.patchFile ?? '-'}`,
    'plugin deps:',
    ...(entry.pluginDependencies.length > 0
      ? entry.pluginDependencies.map(dep => `  - ${dep}`)
      : ['  (none)']),
    'install rows:',
    ...(entry.installRows.length > 0
      ? entry.installRows.map(row => `  - id ${row.id} name ${row.name}`)
      : ['  (none parsed)']),
  ]
  return lines.join('\n')
}

function usage(): string {
  return [
    'usage: dsh-plugin-catalog <command> [options]',
    '',
    'commands:',
    '  list                     list all cataloged bundles',
    '  show <id-or-name>       show one bundle entry in detail',
    '  search <term>           substring search over id/name/description/deps',
    '  generate                regenerate the static manifest from repo packages',
    '',
    'options:',
    '  --manifest <path>   manifest path (default: <pkg>/lib/catalog.json)',
    '  --json              machine-readable output',
    '  --root <dir>        generate: workspace root override',
    '  --out <path>        generate: output path override',
  ].join('\n')
}

export async function main(argv: string[]): Promise<number> {
  let manifestPath: string | undefined
  let json = false
  const positional: string[] = []
  const generateFlags: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg: string | undefined = argv[index]
    if (arg === undefined) continue
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg === '--manifest') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        process.stderr.write('--manifest requires a value\n')
        return 2
      }
      index += 1
      manifestPath = value
      continue
    }
    if (arg === '--root' || arg === '--out') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        process.stderr.write(`${arg} requires a value\n`)
        return 2
      }
      index += 1
      generateFlags.push(arg, value)
      continue
    }
    if (arg.startsWith('--')) {
      process.stderr.write(`unknown argument: ${arg}\n${usage()}\n`)
      return 2
    }
    positional.push(arg)
  }

  const command = positional[0]
  if (command === undefined || command === 'help' || command === '--help') {
    process.stdout.write(`${usage()}\n`)
    return command === undefined ? 2 : 0
  }

  if (command === 'generate') {
    return generateMain(generateFlags)
  }

  let catalog: PluginCatalog
  try {
    catalog = loadCatalog(manifestPath !== undefined ? resolve(manifestPath) : defaultManifestPath())
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }

  if (command === 'list') {
    if (json) {
      process.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`)
    } else {
      process.stdout.write(`${renderBundleTable(catalog.bundles)}\n`)
      process.stdout.write(`${catalog.bundleCount} bundles (${catalog.installableCount} installable)\n`)
    }
    return 0
  }

  if (command === 'show') {
    const selector = positional[1]
    if (selector === undefined) {
      process.stderr.write(`show requires a selector (bundle id or package name)\n${usage()}\n`)
      return 2
    }
    const entry = findBundle(catalog, selector)
    if (entry === undefined) {
      process.stderr.write(`no catalog entry for: ${selector}\n`)
      return 1
    }
    process.stdout.write(json ? `${JSON.stringify(entry, null, 2)}\n` : `${renderBundleDetail(entry)}\n`)
    return 0
  }

  if (command === 'search') {
    const term = positional[1]
    if (term === undefined) {
      process.stderr.write(`search requires a term\n${usage()}\n`)
      return 2
    }
    const matches = searchBundles(catalog, term)
    if (json) {
      process.stdout.write(`${JSON.stringify(matches, null, 2)}\n`)
    } else if (matches.length === 0) {
      process.stdout.write('no matches\n')
    } else {
      process.stdout.write(`${renderBundleTable(matches)}\n`)
      process.stdout.write(`${matches.length} matches for "${term}"\n`)
    }
    return 0
  }

  process.stderr.write(`unknown command: ${command}\n${usage()}\n`)
  return 2
}

// 入口守卫兼容 bin 符号链接：pnpm .bin 链接的 argv[1] 与模块真实路径不同，
// 需 realpath 归一后再比较。
function invokedAsEntry(): boolean {
  if (process.argv[1] === undefined) return false
  const invoked = pathToFileURL(process.argv[1]).href
  if (import.meta.url === invoked) return true
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] as string)).href
  } catch {
    return false
  }
}

if (invokedAsEntry()) {
  void main(process.argv.slice(2)).then(code => {
    process.exitCode = code
  })
}
