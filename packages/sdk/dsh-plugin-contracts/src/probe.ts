/**
 * Capability probe 合同（G18 §6）：probe-first 降级的统一三态。
 * 仓库教义：seam 未合入时不渲染入口（禁用+原因），杜绝死按钮；
 * probe 不得伪造远端调用，也不得把异常吞成 available。
 */

/** 降级两态：needs_contract=官方 seam 未到岗；unavailable=到岗但当前不可用（附原因） */
export type ProbeDegradation = { readonly status: 'needs_contract' } | { readonly status: 'unavailable'; readonly reason: string }

export type ProbeResult<T> = { readonly status: 'available'; readonly capability: T } | ProbeDegradation

/**
 * 探测一个可选 capability：返回 undefined → needs_contract（不注册）；
 * 抛错 → unavailable（附脱敏 reason）；返回值 → available。
 * reason 只取 error.message——不得包含凭据、raw URL 或绝对路径（调用方负责其脱敏）。
 */
export function probeCapability<T>(acquire: () => T | undefined): ProbeResult<T> {
  try {
    const capability = acquire()
    if (capability === undefined) return { status: 'needs_contract' }
    return { status: 'available', capability }
  } catch (error) {
    return { status: 'unavailable', reason: error instanceof Error ? error.message : String(error) }
  }
}
