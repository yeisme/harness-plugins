// 检查器统一结果模型：区分「检查器内部错误」（status=error，退出码 2）
// 与「检查发现红灯」（status=red，退出码 1；--baseline 下降级为观测记录）。
export type CheckerId =
  | 'bundle-contract'
  | 'declaration-lint'
  | 'safe-projection-audit'
  | 'dispose-hmr-conformance'
  | 'visual-token-conformance'
  | 'personal-coding-contract'

export type CheckerStatus = 'pass' | 'red' | 'error'

export interface Finding {
  /** 仓库相对路径，或 <package>/<file> 形式的包内定位；绝不包含绝对路径 */
  location: string
  /** 1-based 行号；文件级发现可缺省 */
  line?: number
  /** 稳定红灯码：CHECKER/规则名，供 G21 清零轨迹对照 */
  code: string
  /** 只描述形状与定位，不回显命中字段值（脱敏规则同集成证据） */
  message: string
}

export interface CheckerReport {
  checker: CheckerId
  status: CheckerStatus
  /** 参与检查的包/文件计数 */
  checkedCount: number
  findings: Finding[]
  notes: string[]
  /** 检查器内部错误（崩溃/输入不可读），与红灯语义分离 */
  error?: string
  durationMs: number
}

export interface ToolchainRunResult {
  startedAt: string
  baseline: boolean
  reports: CheckerReport[]
}

export function report(
  checker: CheckerId,
  checkedCount: number,
  findings: Finding[],
  notes: string[] = [],
): CheckerReport {
  return {
    checker,
    status: findings.length > 0 ? 'red' : 'pass',
    checkedCount,
    findings,
    notes,
    durationMs: 0,
  }
}
