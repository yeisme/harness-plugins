import type { PaneSplitEdge } from './workspace.js'

export const PANE_DRAG_THRESHOLD_PX = 6
export const PANE_DRAG_COARSE_HOLD_MS = 180
export const PANE_DRAG_EDGE_ZONE_PX = 48
export const PANE_DRAG_HYSTERESIS_PX = 12
export const PANE_DRAG_TARGET_STICKY_MS = 80
export const PANE_MIN_PANE_WIDTH = 280
export const PANE_MIN_PANE_HEIGHT = 180

export type PanePointerKind = 'fine' | 'coarse'
export type PaneDragPhase = 'idle' | 'pending' | 'dragging' | 'committing' | 'cancelling'

export interface PaneDragTargetV1 {
  readonly groupId: string
  readonly edge: 'center' | PaneSplitEdge
  readonly enabled: boolean
  readonly index?: number
  readonly reason?: string
}

export interface PaneDragPointerEventV1 {
  readonly clientX: number
  readonly clientY: number
  readonly pointerType?: string
  readonly button?: number
  readonly buttons?: number
  readonly type?: string
  readonly shiftKey?: boolean
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly altKey?: boolean
}

export interface PaneRectV1 {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PaneDropZoneContextV1 {
  readonly groupId: string
  readonly rect: PaneRectV1
  readonly locked?: boolean
  readonly sourceRoleMatches?: boolean
  readonly visibleGroupCount: number
  readonly splitDepth: number
  readonly maxVisibleGroups?: number
  readonly maxSplitDepth?: number
}

export interface PaneFrameSchedulerV1 {
  readonly request: (callback: () => void) => unknown
  readonly cancel: (handle: unknown) => void
}

const defaultPaneFrameScheduler: PaneFrameSchedulerV1 = {
  request: callback => typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame(callback)
    : setTimeout(callback, 0),
  cancel: handle => {
    if (typeof globalThis.cancelAnimationFrame === 'function' && typeof handle === 'number') globalThis.cancelAnimationFrame(handle)
    else if (handle !== undefined) clearTimeout(handle as ReturnType<typeof setTimeout>)
  },
}

export type PaneDragStateV1 =
  | { readonly status: 'idle' }
  | { readonly status: 'pending'; readonly viewId: string; readonly x: number; readonly y: number; readonly pointer: PanePointerKind; readonly startedAt: number }
  | { readonly status: 'dragging'; readonly viewId: string; readonly target?: PaneDragTargetV1; readonly pointer: PanePointerKind }
  | { readonly status: 'committing'; readonly viewId: string; readonly target: PaneDragTargetV1 }
  | { readonly status: 'cancelling'; readonly viewId?: string }

export function pointerKindFromEvent(event: Pick<PaneDragPointerEventV1, 'pointerType'> | string | undefined): PanePointerKind {
  const type = typeof event === 'string' ? event : event?.pointerType
  return type === 'touch' || type === 'pen' ? 'coarse' : 'fine'
}

export function shouldIgnoreDragStart(event: PaneDragPointerEventV1): boolean {
  if (event.type === 'contextmenu' || event.button === 2) return true
  if (event.type === 'scroll' || event.type === 'wheel') return true
  if ((event.buttons ?? 1) === 0 && event.button !== 0 && event.button !== undefined) return true
  return false
}

export function resolveDropTargetFromPoint(
  x: number,
  y: number,
  context: PaneDropZoneContextV1,
  previous?: PaneDragTargetV1,
): PaneDragTargetV1 {
  const { rect } = context
  const localX = x - rect.x
  const localY = y - rect.y
  const edgeWidth = Math.max(PANE_DRAG_EDGE_ZONE_PX, rect.width * 0.2)
  const edgeHeight = Math.max(PANE_DRAG_EDGE_ZONE_PX, rect.height * 0.2)
  let edge: PaneDragTargetV1['edge'] = 'center'
  if (localX <= edgeWidth) edge = 'left'
  else if (localX >= rect.width - edgeWidth) edge = 'right'
  else if (localY <= edgeHeight) edge = 'top'
  else if (localY >= rect.height - edgeHeight) edge = 'bottom'

  if (previous !== undefined && previous.groupId === context.groupId && previous.edge !== edge) {
    const previousBand = previous.edge === 'left' ? localX
      : previous.edge === 'right' ? rect.width - localX
        : previous.edge === 'top' ? localY
          : previous.edge === 'bottom' ? rect.height - localY
            : Number.POSITIVE_INFINITY
    if (previous.edge !== 'center' && previousBand <= edgeWidth + PANE_DRAG_HYSTERESIS_PX) edge = previous.edge
    if (previous.edge === 'center' && edge !== 'center' && previousBand === Number.POSITIVE_INFINITY) {
      const inset = Math.min(localX, rect.width - localX, localY, rect.height - localY)
      if (inset > PANE_DRAG_HYSTERESIS_PX) edge = 'center'
    }
  }

  const locked = Boolean(context.locked) && context.sourceRoleMatches !== true
  const tooSmall = edge === 'left' || edge === 'right'
    ? rect.width < PANE_MIN_PANE_WIDTH * 2
    : edge === 'top' || edge === 'bottom'
      ? rect.height < PANE_MIN_PANE_HEIGHT * 2
      : false
  const depthLimit = (context.splitDepth ?? 0) >= (context.maxSplitDepth ?? 2)
  const groupLimit = (context.visibleGroupCount ?? 0) >= (context.maxVisibleGroups ?? 4)
  const splitBlocked = edge !== 'center' && (tooSmall || depthLimit || groupLimit)
  const reason = locked ? 'locked'
    : splitBlocked && tooSmall ? 'minimum_size'
      : splitBlocked && depthLimit ? 'split_limit'
        : splitBlocked && groupLimit ? 'pane_limit'
          : undefined
  return {
    groupId: context.groupId,
    edge,
    enabled: !locked && !splitBlocked,
    reason,
  }
}

/** Pointer sensor with an explicit cleanup path for Escape, blur, cancel, and HMR disposal. */
export class PaneDragSession {
  private current: PaneDragStateV1 = { status: 'idle' }

  get state(): PaneDragStateV1 { return this.current }

  begin(viewId: string, x: number, y: number, pointer: PanePointerKind | PaneDragPointerEventV1 = 'fine', now = 0): void {
    if (typeof pointer !== 'string' && shouldIgnoreDragStart(pointer)) {
      this.current = { status: 'idle' }
      return
    }
    const kind = typeof pointer === 'string' ? pointer : pointerKindFromEvent(pointer)
    this.current = { status: 'pending', viewId, x, y, pointer: kind, startedAt: now }
  }

  move(x: number, y: number, target?: PaneDragTargetV1, now = 0): PaneDragStateV1 {
    if (this.current.status === 'pending') {
      const distance = Math.hypot(x - this.current.x, y - this.current.y)
      if (this.current.pointer === 'coarse') {
        if (now - this.current.startedAt < PANE_DRAG_COARSE_HOLD_MS) return this.current
        if (distance < PANE_DRAG_THRESHOLD_PX && now - this.current.startedAt < PANE_DRAG_COARSE_HOLD_MS + 16) return this.current
      } else if (distance < PANE_DRAG_THRESHOLD_PX) {
        return this.current
      }
      this.current = { status: 'dragging', viewId: this.current.viewId, target, pointer: this.current.pointer }
      return this.current
    }
    if (this.current.status === 'dragging') this.current = { ...this.current, target }
    return this.current
  }

  drop(): PaneDragTargetV1 | undefined {
    if (this.current.status !== 'dragging') {
      this.current = { status: 'idle' }
      return undefined
    }
    const target = this.current.target
    if (target?.enabled) {
      this.current = { status: 'committing', viewId: this.current.viewId, target }
      const committed = target
      this.current = { status: 'idle' }
      return committed
    }
    this.current = { status: 'cancelling', viewId: this.current.viewId }
    this.current = { status: 'idle' }
    return undefined
  }

  cancel(): void {
    const viewId = this.current.status === 'idle' ? undefined
      : this.current.status === 'cancelling' ? this.current.viewId
        : this.current.viewId
    this.current = { status: 'cancelling', viewId }
    this.current = { status: 'idle' }
  }
}

/** Pointermove only previews through a callback; a single reducer value is committed on pointerup. */
export class PaneResizeSession {
  private latest?: number
  private resizing = false
  private scheduled: unknown

  constructor(
    private readonly preview: (ratio: number | undefined) => void,
    private readonly commit: (ratio: number) => void,
    private readonly scheduler: PaneFrameSchedulerV1 = defaultPaneFrameScheduler,
  ) {}

  begin(): void { this.resizing = true; this.latest = undefined; this.preview(undefined) }
  move(ratio: number): void {
    if (!this.resizing || !Number.isFinite(ratio)) return
    this.latest = ratio
    if (this.scheduled !== undefined) return
    this.scheduled = this.scheduler.request(() => {
      this.scheduled = undefined
      if (this.resizing && this.latest !== undefined) this.preview(this.latest)
    })
  }
  end(ratio?: number): void {
    if (!this.resizing) return
    if (ratio !== undefined && Number.isFinite(ratio)) this.latest = ratio
    this.flushPreview()
    const finalRatio = this.latest
    this.resizing = false
    this.latest = undefined
    this.preview(undefined)
    if (finalRatio !== undefined) this.commit(finalRatio)
  }
  cancel(): void {
    this.cancelScheduled()
    this.resizing = false
    this.latest = undefined
    this.preview(undefined)
  }

  private flushPreview(): void {
    this.cancelScheduled()
    if (this.resizing && this.latest !== undefined) this.preview(this.latest)
  }

  private cancelScheduled(): void {
    if (this.scheduled === undefined) return
    this.scheduler.cancel(this.scheduled)
    this.scheduled = undefined
  }
}
