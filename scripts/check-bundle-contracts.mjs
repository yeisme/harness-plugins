// 构建产物级合同检查：dsh ModuleLoader 单文件契约下，每个 bundle 的
// lib/client.js 必须自包含——不得残留对 @yeisme/* workspace 包或相对
// chunk 的外部 require，且 banner 注册 id 必须等于包名。须在 build 后运行。
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const bundlesRoot = resolve(process.cwd(), 'packages/bundle')
const entries = (await readdir(bundlesRoot, { withFileTypes: true }))
  .filter(dirent => dirent.isDirectory())

let failures = 0
let checked = 0

for (const dirent of entries) {
  const name = dirent.name
  const dir = resolve(bundlesRoot, name)
  let pkg
  try {
    pkg = JSON.parse(await readFile(resolve(dir, 'package.json'), 'utf8'))
  } catch {
    continue
  }
  if (pkg.scripts?.build === undefined) {
    continue // preset/data bundle：无构建产物，不在本合同范围
  }
  const hasClientEntry = pkg.exports?.['./client'] !== undefined
  const clientPath = resolve(dir, 'lib/client.js')
  let source
  try {
    source = await readFile(clientPath, 'utf8')
  } catch {
    if (hasClientEntry) {
      console.error(`MISSING ${name}: exports ./client but lib/client.js not built`)
      failures += 1
    }
    continue
  }
  checked += 1
  const problems = []
  const workspaceRequire = source.match(/require\("@yeisme\/[^"]+"\)/g)
  if (workspaceRequire) {
    problems.push(`external @yeisme require: ${[...new Set(workspaceRequire)].join(', ')}`)
  }
  const relativeRequire = source.match(/require\("\.\/[^"]+"\)/g)
  if (relativeRequire) {
    problems.push(`relative chunk require: ${[...new Set(relativeRequire)].join(', ')}`)
  }
  const banner = source.match(/window\.__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/)
  if (!banner) {
    problems.push('no ModuleLoader banner registration')
  } else if (banner[1] !== pkg.name) {
    problems.push(`banner id "${banner[1]}" !== "${pkg.name}"`)
  }
  if (problems.length > 0) {
    console.error(`FAIL ${name}: ${problems.join('; ')}`)
    failures += 1
  }
}

if (checked === 0) {
  console.error('FAIL no bundles found — run from workspace root after build')
  process.exit(1)
}
console.log(`BUNDLE CONTRACTS: ${checked - failures}/${checked} PASS`)
process.exit(failures === 0 ? 0 : 1)
