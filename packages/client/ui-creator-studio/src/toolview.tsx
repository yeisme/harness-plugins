import type { PaneActionDescriptorV1, PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'

export interface CreatorActionToolViewProps {
  readonly action?: PaneActionDescriptorV1
  readonly receipt?: PaneActionReceiptV1
}

/** Pure ToolView presentation for a future reviewed DSH ToolView registration seam. */
export function CreatorActionToolView({ action, receipt }: CreatorActionToolViewProps) {
  if (action === undefined) return <section aria-label="Creator action result" data-creator-action-toolview="unavailable"><strong>创作操作不可用</strong><p>刷新 Creator Studio 以取得 owner 发布的 action descriptor。</p></section>
  return <section aria-label="Creator action result" aria-live="polite" data-creator-action-toolview="owner-authored">
    <strong>{action.label}</strong>
    <p>{action.preview.summary}</p>
    <p>{`${action.owner} · ${action.risk} · expires ${action.expiresAt}`}</p>
    {action.preview.cost === undefined ? null : <p>{`Estimated ${action.preview.cost.currency} ${action.preview.cost.amount}`}</p>}
    {action.preview.rights === undefined ? null : <p>{`Rights ${action.preview.rights.status}: ${action.preview.rights.summary}`}</p>}
    {receipt === undefined ? <p>等待 owner receipt；本地不推断成功。</p> : <p>{`${receipt.status}: ${receipt.summary ?? receipt.reconcileReason ?? receipt.receiptRef}`}</p>}
  </section>
}
