// 薄委托：实现已收编至 packages/tool/dsh-plugin-toolchain（G18 Wave 1），
// 本文件保留为 `pnpm check:bundles` 与既有 CI 引用的稳定入口（零修改）。
// 语义与收编前逐字一致：须在 build 后运行。
import { runBundleContractCheck, findWorkspaceRoot } from '@yeisme/dsh-plugin-toolchain'

const root = findWorkspaceRoot(process.cwd())
const result = await runBundleContractCheck(root)
for (const finding of result.findings) {
  console.error(`FAIL ${finding.location}: ${finding.message}`)
}
if (result.status === 'error') {
  console.error(result.error)
  process.exit(1)
}
console.log(`BUNDLE CONTRACTS: ${result.checkedCount - result.findings.length}/${result.checkedCount} PASS`)
process.exit(result.findings.length === 0 ? 0 : 1)
