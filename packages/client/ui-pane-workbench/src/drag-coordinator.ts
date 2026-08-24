import { PaneDragSession, type PaneDragStateV1, type PaneDragTargetV1 } from './interactions.js'
import type { PaneWorkspaceIntentV1, PaneWorkspaceReducerResultV1, PaneWorkspaceV1 } from './workspace.js'
import { formatT } from './i18n/locale.js'

export interface PaneDragCoordinatorSnapshot {
  readonly drag: PaneDragStateV1
  readonly target?: PaneDragTargetV1
  readonly announcement: string
}

const IDLE: PaneDragCoordinatorSnapshot = Object.freeze({
  drag: { status: 'idle' as const },
  announcement: '',
})

/** One drag generation shared by the Right and Bottom React slot roots. */
export class PaneDragCoordinator {
  private readonly session = new PaneDragSession()
  private readonly listeners = new Set<() => void>()
  private snapshot: PaneDragCoordinatorSnapshot = IDLE

  constructor(
    private readonly getWorkspace: () => PaneWorkspaceV1,
    private readonly dispatch: (intent: PaneWorkspaceIntentV1) => PaneWorkspaceReducerResultV1,
  ) {}

  readonly getSnapshot = (): PaneDragCoordinatorSnapshot => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  // V4 Task 3.5: Fine/coarse pointer gate, cross-root generation cleanup
  begin(viewId: string, x: number, y: number, pointerType: 'fine' | 'coarse' = 'fine'): void {
    this.session.begin(viewId, x, y, pointerType)
    this.publish('')
  }

  move(x: number, y: number, target?: PaneDragTargetV1): PaneDragStateV1 {
    const next = this.session.move(x, y, target)
    const resolvedTarget = next.status === 'dragging' ? next.target : undefined
    const announcement = resolvedTarget === undefined
      ? ''
      : resolvedTarget.enabled
        ? `${resolvedTarget.edge === 'center' ? formatT('drag.moveTo', {}) : formatT('drag.splitAt', {})} ${resolvedTarget.groupId}; ${formatT('drag.releaseToApply', {})}`
        : formatT('drag.dropUnavailable', { reason: resolvedTarget.reason ?? formatT('drag.notAllowed', {}) })
    this.publish(announcement)
    return next
  }

  drop(): PaneWorkspaceReducerResultV1 | undefined {
    // V4 Task 3.5: Handle committing phase
    const sourceViewId = this.session.state.status === 'dragging' || this.session.state.status === 'committing'
      ? this.session.state.viewId
      : undefined
    const target = this.session.drop()

    if (sourceViewId === undefined || target === undefined) {
      this.publish(formatT('drag.cancelled', {}))
      return undefined
    }

    const source = this.getWorkspace().views[sourceViewId]
    if (source === undefined) {
      this.publish(formatT('drag.sourceUnavailable', {}))
      return undefined
    }

    const intent: PaneWorkspaceIntentV1 = target.edge === 'center'
      ? source.groupId === target.groupId && target.index !== undefined
        ? { type: 'reorder_view', viewId: sourceViewId, targetGroupId: target.groupId, index: target.index }
        : { type: 'move_view', viewId: sourceViewId, targetGroupId: target.groupId, index: target.index }
      : { type: 'split_with_view', viewId: sourceViewId, targetGroupId: target.groupId, edge: target.edge }
    const result = this.dispatch(intent)
    this.publish(result.effects[0]?.message ?? (result.accepted ? formatT('drag.moved', {}) : formatT('drag.dropUnavailable', { reason: result.reason ?? formatT('drag.notAllowed', {}) })))
    return result
  }

  cancel(message?: string): void {
    if (this.session.state.status === 'idle' && this.snapshot.target === undefined) return
    this.session.cancel(message)
    this.publish(message ?? formatT('drag.cancelled', {}))
  }

  // V4 Task 3.5: Cross-root generation cleanup with proper disposal
  dispose(): void {
    this.session.dispose()
    this.snapshot = IDLE
    this.listeners.clear()
  }

  private publish(announcement: string): void {
    const drag = this.session.state
    const target = drag.status === 'dragging' ? drag.target : undefined
    this.snapshot = Object.freeze({ drag, target, announcement })
    for (const listener of [...this.listeners]) {
      try { listener() } catch { /* drag observers are isolated */ }
    }
  }
}
