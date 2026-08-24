import {
  PANE_DRAG_TARGET_STICKY_MS,
  PaneDragSession,
  pointerKindFromEvent,
  resolveDropTargetFromPoint,
  shouldIgnoreDragStart,
  type PaneDragPointerEventV1,
  type PaneDragStateV1,
  type PaneDragTargetV1,
  type PaneDropZoneContextV1,
  type PaneFrameSchedulerV1,
  type PanePointerKind,
  type PaneRectV1,
} from './interactions.js'
import type { PaneSplitEdge, PaneWorkspaceIntentV1, PaneWorkspaceReducerResultV1, PaneWorkspaceV1 } from './workspace.js'
import { formatT } from './i18n/locale.js'

export const PANE_MOTION_TOKENS = Object.freeze({
  instant: 80,
  fast: 120,
  layout: 140,
  region: 180,
  easing: 'cubic-bezier(.2,.8,.2,1)',
})

export type PaneMotionPreference = 'system' | 'full' | 'reduced'

export interface PaneDragGhostV1 {
  readonly viewId: string
  readonly title: string
  readonly icon: string
  readonly dirty: boolean
  readonly pinned: boolean
  readonly preview: boolean
  readonly x: number
  readonly y: number
}

export interface PaneDragVisualsV1 {
  readonly ghost?: PaneDragGhostV1
  readonly placeholderViewId?: string
  readonly insertion?: PaneDragTargetV1
}

export interface PaneFlipPlanV1 {
  readonly viewId: string
  readonly from: PaneRectV1
  readonly to: PaneRectV1
  readonly durationMs: number
}

export interface PaneDragCoordinatorSnapshot {
  readonly generation: number
  readonly drag: PaneDragStateV1
  readonly target?: PaneDragTargetV1
  readonly visuals: PaneDragVisualsV1
  readonly announcement: string
  readonly dispatchCount: number
}

const IDLE: PaneDragCoordinatorSnapshot = Object.freeze({
  generation: 0,
  drag: { status: 'idle' as const },
  visuals: Object.freeze({}),
  announcement: '',
  dispatchCount: 0,
})

const defaultScheduler: PaneFrameSchedulerV1 = {
  request: callback => typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame(callback)
    : setTimeout(callback, 0),
  cancel: handle => {
    if (typeof globalThis.cancelAnimationFrame === 'function' && typeof handle === 'number') globalThis.cancelAnimationFrame(handle)
    else if (handle !== undefined) clearTimeout(handle as ReturnType<typeof setTimeout>)
  },
}

export function createDragGhostPayload(state: PaneWorkspaceV1, viewId: string, x: number, y: number): PaneDragGhostV1 | undefined {
  const view = state.views[viewId]
  if (view === undefined) return undefined
  return {
    viewId: view.id,
    title: view.title,
    icon: view.kind.startsWith('terminal.') ? 'terminal' : view.kind.startsWith('file.') ? 'file' : 'window',
    dirty: view.dirty,
    pinned: view.pinned,
    preview: view.preview,
    x,
    y,
  }
}

export function intentForDragTarget(viewId: string, sourceGroupId: string, target: PaneDragTargetV1): PaneWorkspaceIntentV1 {
  return target.edge === 'center'
    ? sourceGroupId === target.groupId && target.index !== undefined
      ? { type: 'reorder_view', viewId, targetGroupId: target.groupId, index: target.index }
      : { type: 'move_view', viewId, targetGroupId: target.groupId, index: target.index }
    : { type: 'split_with_view', viewId, targetGroupId: target.groupId, edge: target.edge }
}

export function listKeyboardMoveTargets(
  workspace: PaneWorkspaceV1,
  viewId: string,
  zones: readonly PaneDropZoneContextV1[],
): readonly PaneDragTargetV1[] {
  const view = workspace.views[viewId]
  if (view === undefined) return []
  return zones.flatMap(zone => {
    const context = { ...zone, sourceRoleMatches: zone.sourceRoleMatches ?? zone.locked !== true }
    const samples: Array<readonly [number, number]> = [
      [zone.rect.x + zone.rect.width / 2, zone.rect.y + zone.rect.height / 2],
      [zone.rect.x + 4, zone.rect.y + zone.rect.height / 2],
      [zone.rect.x + zone.rect.width - 4, zone.rect.y + zone.rect.height / 2],
      [zone.rect.x + zone.rect.width / 2, zone.rect.y + 4],
      [zone.rect.x + zone.rect.width / 2, zone.rect.y + zone.rect.height - 4],
    ]
    return samples.map(([x, y]) => resolveDropTargetFromPoint(x, y, context))
  })
}

export function planCrossRootFlip(
  first: Readonly<Record<string, PaneRectV1>>,
  last: Readonly<Record<string, PaneRectV1>>,
  motion: PaneMotionPreference,
  reducedMotion: boolean,
): readonly PaneFlipPlanV1[] {
  if (motion === 'reduced' || reducedMotion) return []
  const durationMs = PANE_MOTION_TOKENS.layout
  return Object.keys(last).flatMap(viewId => {
    const from = first[viewId]
    const to = last[viewId]
    if (from === undefined || to === undefined) return []
    if (from.x === to.x && from.y === to.y && from.width === to.width && from.height === to.height) return []
    return [{ viewId, from, to, durationMs }]
  })
}

export type PaneHeavyViewKind = 'media' | 'terminal' | 'generic'

export interface PaneCrossRootMovePlanV1 {
  readonly viewId: string
  readonly kind: PaneHeavyViewKind
  readonly steps: readonly ('suspend-old' | 'activate-new')[]
  readonly allowDoubleMount: false
}

export function planCrossRootViewLifecycle(kind: string, viewId: string): PaneCrossRootMovePlanV1 {
  const heavy: PaneHeavyViewKind = kind.includes('terminal') ? 'terminal' : kind.includes('media') ? 'media' : 'generic'
  // 跨 root 提交必须先挂起旧宿主，再激活新宿主。媒体/终端若双挂载会重复订阅或双解码。
  return {
    viewId,
    kind: heavy,
    steps: ['suspend-old', 'activate-new'],
    allowDoubleMount: false,
  }
}

/** One drag generation shared by the Right and Bottom React slot roots. */
export class PaneDragCoordinator {
  private readonly session = new PaneDragSession()
  private readonly listeners = new Set<() => void>()
  private snapshot: PaneDragCoordinatorSnapshot = IDLE
  private scheduled: unknown
  private pendingPoint?: { x: number; y: number; target?: PaneDragTargetV1 }
  private lastTargetAt = 0
  private lastPublishedTarget?: PaneDragTargetV1
  private dispatchCount = 0
  private generation = 0
  private lastPoint = { x: 0, y: 0 }

  constructor(
    private readonly getWorkspace: () => PaneWorkspaceV1,
    private readonly dispatch: (intent: PaneWorkspaceIntentV1) => PaneWorkspaceReducerResultV1,
    private readonly scheduler: PaneFrameSchedulerV1 = defaultScheduler,
  ) {}

  readonly getSnapshot = (): PaneDragCoordinatorSnapshot => this.snapshot

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  begin(viewId: string, x: number, y: number, pointer?: PanePointerKind | PaneDragPointerEventV1, now = 0): void {
    if (typeof pointer !== 'string' && pointer !== undefined && shouldIgnoreDragStart(pointer)) return
    this.generation += 1
    this.lastPoint = { x, y }
    this.session.begin(viewId, x, y, pointer ?? 'fine', now)
    this.publish(this.generation, '')
  }

  move(x: number, y: number, target?: PaneDragTargetV1, now = 0): PaneDragStateV1 {
    this.lastPoint = { x, y }
    this.pendingPoint = { x, y, target }
    if (this.scheduled !== undefined) return this.session.state
    this.scheduled = this.scheduler.request(() => {
      this.scheduled = undefined
      const pending = this.pendingPoint
      if (pending === undefined) return
      const next = this.session.move(pending.x, pending.y, this.stabilizeTarget(pending.target, now), now)
      const resolvedTarget = next.status === 'dragging' ? next.target : undefined
      const announcement = resolvedTarget === undefined
        ? ''
        : resolvedTarget.enabled
          ? `${resolvedTarget.edge === 'center' ? formatT('drag.moveTo', {}) : formatT('drag.splitAt', {})} ${resolvedTarget.groupId}; ${formatT('drag.releaseToApply', {})}`
          : formatT('drag.dropUnavailable', { reason: resolvedTarget.reason ?? formatT('drag.notAllowed', {}) })
      this.publish(this.generation, announcement)
    })
    return this.session.state
  }

  drop(): PaneWorkspaceReducerResultV1 | undefined {
    this.flushVisual()
    const sourceViewId = this.session.state.status === 'dragging' ? this.session.state.viewId : undefined
    const target = this.session.drop()
    if (sourceViewId === undefined || target === undefined) {
      this.publish(this.generation, formatT('drag.cancelled', {}))
      return undefined
    }
    const source = this.getWorkspace().views[sourceViewId]
    if (source === undefined) {
      this.publish(this.generation, formatT('drag.sourceUnavailable', {}))
      return undefined
    }
    const intent = intentForDragTarget(sourceViewId, source.groupId, target)
    this.dispatchCount += 1
    const result = this.dispatch(intent)
    this.publish(this.generation, result.effects[0]?.message ?? (result.accepted ? formatT('drag.moved', {}) : formatT('drag.dropUnavailable', { reason: result.reason ?? formatT('drag.notAllowed', {}) })))
    return result
  }

  cancel(message?: string): void {
    if (this.session.state.status === 'idle' && this.snapshot.target === undefined) return
    this.session.cancel()
    this.flushVisual()
    this.publish(this.generation, message ?? formatT('drag.cancelled', {}))
  }

  resolveTarget(x: number, y: number, zone: PaneDropZoneContextV1): PaneDragTargetV1 {
    return resolveDropTargetFromPoint(x, y, zone, this.lastPublishedTarget)
  }

  keyboardTargets(viewId: string, zones: readonly PaneDropZoneContextV1[]): readonly PaneDragTargetV1[] {
    return listKeyboardMoveTargets(this.getWorkspace(), viewId, zones)
  }

  applyKeyboardTarget(viewId: string, target: PaneDragTargetV1): PaneWorkspaceReducerResultV1 | undefined {
    if (!target.enabled) {
      this.publish(this.generation, formatT('drag.dropUnavailable', { reason: target.reason ?? formatT('drag.notAllowed', {}) }))
      return undefined
    }
    const source = this.getWorkspace().views[viewId]
    if (source === undefined) return undefined
    this.dispatchCount += 1
    const result = this.dispatch(intentForDragTarget(viewId, source.groupId, target))
    this.publish(this.generation, result.effects[0]?.message ?? formatT('drag.moved', {}))
    return result
  }

  dispose(): void {
    this.session.cancel()
    this.flushVisual()
    this.snapshot = IDLE
    this.listeners.clear()
  }

  private stabilizeTarget(target: PaneDragTargetV1 | undefined, now: number): PaneDragTargetV1 | undefined {
    if (target === undefined) return this.lastPublishedTarget
    if (
      this.lastPublishedTarget !== undefined
      && now - this.lastTargetAt < PANE_DRAG_TARGET_STICKY_MS
      && (this.lastPublishedTarget.groupId !== target.groupId || this.lastPublishedTarget.edge !== target.edge)
    ) {
      return this.lastPublishedTarget
    }
    this.lastPublishedTarget = target
    this.lastTargetAt = now
    return target
  }

  private flushVisual(): void {
    if (this.scheduled === undefined) return
    this.scheduler.cancel(this.scheduled)
    this.scheduled = undefined
    const pending = this.pendingPoint
    if (pending === undefined) return
    this.session.move(pending.x, pending.y, pending.target)
    this.pendingPoint = undefined
  }

  private publish(generation: number, announcement: string): void {
    const drag = this.session.state
    const viewId = drag.status === 'idle' || drag.status === 'cancelling' ? undefined : drag.viewId
    const target = drag.status === 'dragging' ? drag.target : undefined
    const ghost = viewId === undefined ? undefined : createDragGhostPayload(this.getWorkspace(), viewId, this.lastPoint.x, this.lastPoint.y)
    this.snapshot = Object.freeze({
      generation,
      drag,
      target,
      visuals: Object.freeze({
        ghost,
        placeholderViewId: drag.status === 'dragging' || drag.status === 'pending' ? viewId : undefined,
        insertion: target,
      }),
      announcement,
      dispatchCount: this.dispatchCount,
    })
    for (const listener of [...this.listeners]) {
      try { listener() } catch { /* drag observers are isolated */ }
    }
  }
}

export function isReducedMotion(preference: PaneMotionPreference, systemReduced: boolean): boolean {
  return preference === 'reduced' || (preference === 'system' && systemReduced)
}


