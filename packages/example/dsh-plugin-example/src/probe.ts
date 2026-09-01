/**
 * Capability probe 三态合同（源合同：packages/sdk/dsh-plugin-contracts probe.ts）。
 *
 * 仓库教义（probe-first 降级）：seam 未合入时不渲染入口（禁用+原因），
 * 杜绝死按钮；probe 不得伪造远端调用，也不得把异常吞成 available。
 * 本包是零运行时依赖的自包含参考插件，故在源内镜像合同而不是依赖 sdk 包
 * （ModuleLoader 单文件契约下 client.js 不得残留对 @yeisme 包的外部 require）；
 * tests/probe.spec.ts 与 sdk 实现做行为与形状双 parity（防漂移网）。
 */

/** 降级两态：needs_contract=官方 seam 未到岗；unavailable=到岗但当前不可用（附原因） */
export type ProbeDegradation = { readonly status: 'needs_contract' } | { readonly status: 'unavailable'; readonly reason: string }

export type ProbeResult<T> = { readonly status: 'available'; readonly capability: T } | ProbeDegradation

/**
 * 探测一个可选 capability：返回 undefined → needs_contract（不注册）；
 * 抛错 → unavailable（附脱敏 reason）；返回值 → available。
 * reason 只取 error.message——不得包含凭据、raw URL 或绝对路径。
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

/** 降级原因文案（供禁用态展示；与 sdk 合同同语义，只描述状态不携带敏感数据）。 */
export function degradeReason(probe: ProbeDegradation): string {
  if (probe.status === 'needs_contract') return 'seam not shipped in this host (needs_contract)'
  return `seam unavailable: ${probe.reason}`
}
