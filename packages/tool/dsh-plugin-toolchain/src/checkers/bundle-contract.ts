import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { report, type CheckerReport, type Finding } from '../types.js'

/**
 * 构建产物级合同检查（自 scripts/check-bundle-contracts.mjs 收编，语义逐字保留）：
 * dsh ModuleLoader 单文件契约下，每个 bundle 的 lib/client.js 必须自包含——
 * 不得残留对 @yeisme/* workspace 包或相对 chunk 的外部 require，
 * 且 banner 注册 id 必须等于包名。须在 build 后运行。
 */
export async function runBundleContractCheck(root: string): Promise<CheckerReport> {
  const bundlesRoot = resolve(root, 'packages/bundle')
  const entries = (await readdir(bundlesRoot, { withFileTypes: true })).filter(dirent => dirent.isDirectory())

  const findings: Finding[] = []
  let checked = 0
  const notes: string[] = []

  for (const dirent of entries) {
    const name = dirent.name
    const dir = resolve(bundlesRoot, name)
    let pkg: { name?: string; scripts?: Record<string, unknown>; exports?: Record<string, unknown> }
    try {
      pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    if (pkg.scripts?.build === undefined) {
      continue // preset/data bundle：无构建产物，不在本合同范围
    }
    const hasClientEntry = pkg.exports?.['./client'] !== undefined
    let source: string
    try {
      source = await readFile(join(dir, 'lib/client.js'), 'utf8')
    } catch {
      if (hasClientEntry) {
        findings.push({
          location: `packages/bundle/${name}`,
          code: 'BUNDLE/CLIENT_NOT_BUILT',
          message: 'exports ./client but lib/client.js not built',
        })
      }
      continue
    }
    checked += 1
    const workspaceRequire = source.match(/require\("@yeisme\/[^"]+"\)/g)
    if (workspaceRequire) {
      findings.push({
        location: `packages/bundle/${name}/lib/client.js`,
        code: 'BUNDLE/EXTERNAL_YEISME_REQUIRE',
        message: `external @yeisme require: ${[...new Set(workspaceRequire)].join(', ')}`,
      })
    }
    const relativeRequire = source.match(/require\("\.\/[^"]+"\)/g)
    if (relativeRequire) {
      findings.push({
        location: `packages/bundle/${name}/lib/client.js`,
        code: 'BUNDLE/RELATIVE_CHUNK_REQUIRE',
        message: `relative chunk require: ${[...new Set(relativeRequire)].join(', ')}`,
      })
    }
    const banner = source.match(/window\.__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/)
    if (!banner) {
      findings.push({
        location: `packages/bundle/${name}/lib/client.js`,
        code: 'BUNDLE/NO_BANNER_REGISTRATION',
        message: 'no ModuleLoader banner registration',
      })
    } else if (banner[1] !== pkg.name) {
      findings.push({
        location: `packages/bundle/${name}/lib/client.js`,
        code: 'BUNDLE/BANNER_ID_MISMATCH',
        message: `banner id mismatch: registered "${banner[1]}", package "${String(pkg.name)}"`,
      })
    }
  }

  if (checked === 0) {
    // 与原脚本一致：一个都没查到视为运行环境错误（未 build 或不在仓库根），
    // 属内部错误而非红灯。
    return {
      checker: 'bundle-contract',
      status: 'error',
      checkedCount: 0,
      findings,
      notes,
      error: 'no bundles found — run from workspace root after build',
      durationMs: 0,
    }
  }
  if (notes.length === 0 && findings.length === 0) notes.push(`${checked} bundles checked`)
  return report('bundle-contract', checked, findings, notes)
}
