/**
 * 清单生成（库 + CLI 命令）：从仓库包生成静态清单 JSON。
 *
 * 经由查询 CLI 执行：`node lib/cli.mjs generate [--root <dir>] [--out <path>]`。
 * 默认 root = 从本模块位置向上找 pnpm-workspace.yaml；默认 out = 本包
 * lib/catalog.json（构建产物，随 build 步骤重生成；不手写、不提交）。
 * 本模块不携带可执行入口守卫——cli.mjs 是唯一 bin 入口，避免内联副本
 * 在其他 bundle 里被误触发。
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverBundles, findWorkspaceRoot } from './discover.js'
import { CATALOG_SCHEMA_VERSION, type PluginCatalog } from './schema.js'

export const GENERATOR_NAME = '@yeisme/dsh-plugin-catalog'

/** 由仓库包构建清单对象（纯函数：只读扫描，不写任何文件）。 */
export function buildCatalog(root: string): PluginCatalog {
  const bundles = discoverBundles(root)
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    generator: GENERATOR_NAME,
    generatedAt: new Date().toISOString(),
    bundleCount: bundles.length,
    installableCount: bundles.filter(entry => entry.installable).length,
    bundles,
  }
}

/** 序列化清单（稳定字段序 + 尾随换行；bundles 已按 id 排序）。 */
export function serializeCatalog(catalog: PluginCatalog): string {
  return `${JSON.stringify(catalog, null, 2)}\n`
}

export async function writeCatalog(catalog: PluginCatalog, outPath: string): Promise<string> {
  const target = resolve(outPath)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, serializeCatalog(catalog), 'utf8')
  return target
}

/** 生成 CLI main；返回进程退出码（0 成功，2 用法/输入错误）。 */
export async function main(argv: string[]): Promise<number> {
  let root: string | undefined
  let out: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--root' || arg === '--out') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        process.stderr.write(`${arg} requires a value\n`)
        return 2
      }
      index += 1
      if (arg === '--root') root = value
      else out = value
      continue
    }
    process.stderr.write(`unknown argument: ${arg}\n`)
    return 2
  }

  const workspaceRoot = root !== undefined ? resolve(root) : findWorkspaceRoot(dirname(fileURLToPath(import.meta.url)))
  const catalog = buildCatalog(workspaceRoot)
  const target = await writeCatalog(catalog, out ?? defaultManifestPath())
  process.stdout.write(`catalog: ${catalog.bundleCount} bundles (${catalog.installableCount} installable) -> ${target}\n`)
  return 0
}

/** 默认清单路径：本包 lib/catalog.json（与构建产物同目录，随 build 重生成）。 */
export function defaultManifestPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), 'catalog.json')
}
