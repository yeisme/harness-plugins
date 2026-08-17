/**
 * 单次 Ordo action 的 future ToolView face。
 *
 * 本模块不注册 ToolView，也不发起网络请求：只有 Host 已验证的 server-authored
 * descriptor 与 owner receipt 被明确传入时才显示事实。这样 rc.7 profile 不会把
 * placeholder、浏览器生成的 approval 或本地 terminal 状态误作为可执行动作。
 */

import type { OrdoAgentOpsActionDescriptor, OrdoAgentOpsActionReceipt } from '../host/types.ts'

export interface OrdoAgentOpsToolViewProps {
  readonly action?: OrdoAgentOpsActionDescriptor
  readonly receipt?: OrdoAgentOpsActionReceipt
}

/** 供未来 DSH public ToolView adapter 使用的纯展示组件。 */
export function OrdoAgentOpsToolView({ action, receipt }: OrdoAgentOpsToolViewProps) {
  if (action === undefined) {
    return (
      <section aria-label="Ordo action result" aria-live="polite" data-ordo-agent-ops-toolview="unavailable">
        <strong>Action unavailable</strong>
        <p>No server-authored action descriptor is available. Refresh the owner projection.</p>
      </section>
    )
  }
  return (
    <section aria-label="Ordo action result" aria-live="polite" data-ordo-agent-ops-toolview="owner-authored">
      <strong>Owner action preview</strong>
      <p>{`Target ${action.targetRef}: ${action.safeEffect}`}</p>
      <p>{`Owner ${action.ownerRef}; expires ${action.expiresAt}.`}</p>
      <p>{`Decision ${action.decisionRef}; preview digest ${action.previewDigest}.`}</p>
      {receipt === undefined
        ? <p>Awaiting an owner-confirmed receipt; no local result is inferred.</p>
        : <p>{`Receipt ${receipt.receiptRef}: ${receipt.state}; ${receipt.safeSummary}`}</p>}
    </section>
  )
}
