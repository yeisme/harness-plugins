/** @deprecated 0.1.0-rc.7 compatibility browser entry. */

export {
  OrdoAgentOpsController,
  OrdoAgentOpsCursor,
  OrdoAgentOpsSidebar as OrdoAgentOpsPanel,
  applyLegacyClient as apply,
  inject,
} from '@yeisme/dsh-ordo-agent-ops/client-runtime'
export {
  createOrdoPopupItems,
  createOrdoPopupState,
  openOrdoPopup,
  applyOrdoPopupKey,
  selectOrdoPopupItem,
  canSubmitOrdoPopupMutation,
} from '@yeisme/dsh-ordo-agent-ops/src/client/popup.ts'
export type {
  OrdoAgentOpsKey,
  OrdoAgentOpsPanelFace,
  OrdoAgentOpsSidebarProps as OrdoAgentOpsPanelProps,
  OrdoAgentOpsSnapshot,
  OrdoAgentOpsViewState,
  OrdoAgentOpsReadPhase,
} from '@yeisme/dsh-ordo-agent-ops/client-runtime'
export type {
  OrdoPopupCommandId,
  OrdoPopupItemV1,
  OrdoPopupStateV1,
  OrdoPopupKeyEventV1,
} from '@yeisme/dsh-ordo-agent-ops/src/client/popup.ts'
