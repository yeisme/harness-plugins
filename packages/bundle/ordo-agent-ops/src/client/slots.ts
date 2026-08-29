import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { OrdoAgentOpsViewState } from './controller.ts'

/** sidebar action 注入的展示状态与刷新动作。 */
export interface OrdoAgentOpsPanelFace {
  hooks: {
    state: HostObservable<OrdoAgentOpsViewState>
  }
  refresh: () => Promise<void>
  /** Opens the canonical Agents Pane; false keeps the compact Ops fallback. */
  openAgentsPane?: () => boolean
}
