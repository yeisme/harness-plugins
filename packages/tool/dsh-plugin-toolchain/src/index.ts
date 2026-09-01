import { runBundleContractCheck } from './checkers/bundle-contract.js'
import { runDeclarationLint } from './checkers/declaration-lint.js'
import { runDisposeConformance } from './checkers/dispose-conformance.js'
import { runSafeProjectionAudit } from './checkers/safe-projection-audit.js'
import { runVisualTokenConformance } from './checkers/visual-token.js'
import type { CheckerId, CheckerReport, ToolchainRunResult } from './types.js'

export type { CheckerId, CheckerReport, Finding, ToolchainRunResult } from './types.js'
export { findWorkspaceRoot, listWorkspacePackages } from './workspace.js'
export { writeRunReport } from './report.js'
export { runBundleContractCheck, runDeclarationLint, runDisposeConformance, runSafeProjectionAudit, runVisualTokenConformance }

const ALL_CHECKERS: CheckerId[] = [
  'bundle-contract',
  'declaration-lint',
  'safe-projection-audit',
  'dispose-hmr-conformance',
  'visual-token-conformance',
]

/** 顺序执行选定的检查器，逐包汇总（G18 §1.3 统一入口的后端） */
export async function runPluginChecks(options: {
  root: string
  only?: CheckerId[]
  baseline?: boolean
  now?: () => string
}): Promise<ToolchainRunResult> {
  const requested = options.only !== undefined && options.only.length > 0 ? options.only : ALL_CHECKERS
  const reports: CheckerReport[] = []
  for (const id of ALL_CHECKERS) {
    if (!requested.includes(id)) continue
    const startedAt = Date.now()
    let reportItem: CheckerReport
    try {
      // 每个检查器独立捕获异常：内部错误只击沉该检查器，不拖垮整轮。
      switch (id) {
        case 'bundle-contract':
          reportItem = await runBundleContractCheck(options.root)
          break
        case 'declaration-lint':
          reportItem = runDeclarationLint(options.root)
          break
        case 'safe-projection-audit':
          reportItem = runSafeProjectionAudit(options.root)
          break
        case 'dispose-hmr-conformance':
          reportItem = runDisposeConformance(options.root)
          break
        case 'visual-token-conformance':
          reportItem = runVisualTokenConformance(options.root)
          break
      }
    } catch (error) {
      reportItem = {
        checker: id,
        status: 'error',
        checkedCount: 0,
        findings: [],
        notes: [],
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      }
    }
    reportItem.durationMs = Date.now() - startedAt
    reports.push(reportItem)
  }
  return {
    // 不携带仓库绝对路径（报告脱敏：只含仓库相对定位）
    startedAt: options.now !== undefined ? options.now() : new Date().toISOString(),
    baseline: options.baseline === true,
    reports,
  }
}

export function summarizeExitCode(result: ToolchainRunResult): number {
  // 退出码语义（§1.3）：检查器内部错误=2；发现红灯=1（baseline 模式降级为 0，只记录）。
  if (result.reports.some(reportItem => reportItem.status === 'error')) return 2
  if (!result.baseline && result.reports.some(reportItem => reportItem.status === 'red')) return 1
  return 0
}
