import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { OrdoAgentOpsViewState } from './controller.ts'

/** Injected facts and lifecycle verbs for the compact Agent Ops action. */
export interface OrdoAgentOpsPanelFace {
  hooks: {
    state: HostObservable<OrdoAgentOpsViewState>
  }
  refresh: () => Promise<void>
}
