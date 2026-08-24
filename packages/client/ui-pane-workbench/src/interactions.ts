import type { PaneSplitEdge } from './workspace.js'

export const PANE_DRAG_THRESHOLD_PX = 6
export const PANE_COARSE_POINTER_PRESS_MS = 180

export interface PaneDragTargetV1 {
  readonly groupId: string
  readonly edge: 'center' | PaneSplitEdge
  readonly enabled: boolean
  readonly index?: number
  readonly reason?: string
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

// V4 Task 3.5: Extended drag state with committing/cancelling phases
export type PaneDragStateV1 =
  | { readonly status: 'idle' }
  | { readonly status: 'pending'; readonly viewId: string; readonly x: number; readonly y: number; readonly pointerType: 'fine' | 'coarse'; readonly pressTimer?: unknown }
  | { readonly status: 'dragging'; readonly viewId: string; readonly target?: PaneDragTargetV1; readonly pointerType: 'fine' | 'coarse' }
  | { readonly status: 'committing'; readonly viewId: string; readonly target: PaneDragTargetV1 }
  | { readonly status: 'cancelling'; readonly reason: string }

/** V4 Task 3.5: Extended drag session with fine/coarse pointer gates and cross-root generation cleanup. */
export class PaneDragSession {
  private current: PaneDragStateV1 = { status: 'idle' }
  private readonly scheduler: PaneFrameSchedulerV1

  constructor(scheduler?: PaneFrameSchedulerV1) {
    this.scheduler = scheduler ?? defaultPaneFrameScheduler
  }

  get state(): PaneDragStateV1 { return this.current }

  // V4 Task 3.5: Fine pointer starts immediately, coarse pointer requires long press
  begin(viewId: string, x: number, y: number, pointerType: 'fine' | 'coarse' = 'fine'): void {
    if (this.current.status !== 'idle') return

    // Fine pointer: enter pending immediately
    // Coarse pointer: enter pending with timer
    if (pointerType === 'fine') {
      this.current = { status: 'pending', viewId, x, y, pointerType: 'fine' }
    } else {
      const timer = this.scheduler.request(() => {
        // Only transition to dragging if still pending and coarse
        if (this.current.status === 'pending' && this.current.pointerType === 'coarse') {
          // Coarse press exceeded threshold, will enter dragging on next move
        }
      })
      this.current = { status: 'pending', viewId, x, y, pointerType: 'coarse', pressTimer: timer }
    }
  }

  move(x: number, y: number, target?: PaneDragTargetV1): PaneDragStateV1 {
    if (this.current.status === 'pending') {
      // Cancel coarse press timer if we move before timeout
      if (this.current.pointerType === 'coarse' && this.current.pressTimer) {
        this.scheduler.cancel(this.current.pressTimer)
      }

      // Fine pointer: check threshold
      // Coarse pointer: already passed press timer or dragging
      const threshold = PANE_DRAG_THRESHOLD_PX
      const distance = Math.hypot(x - this.current.x, y - this.current.y)

      if (distance < threshold) return this.current

      this.current = { status: 'dragging', viewId: this.current.viewId, target, pointerType: this.current.pointerType }
      return this.current
    }

    if (this.current.status === 'dragging') {
      this.current = { ...this.current, target }
    }

    return this.current
  }

  // V4 Task 3.5: Commit phase before final idle
  drop(): PaneDragTargetV1 | undefined {
    if (this.current.status !== 'dragging') {
      // Direct to idle for invalid drop (backward compatibility)
      if (this.current.status === 'pending' && this.current.pressTimer) {
        this.scheduler.cancel(this.current.pressTimer)
      }
      this.current = { status: 'idle' }
      return undefined
    }

    const target = this.current.target
    if (!target?.enabled) {
      // Direct to idle for disabled target (backward compatibility)
      this.current = { status: 'idle' }
      return undefined
    }

    this.current = { status: 'committing', viewId: this.current.viewId, target }

    // Auto-transition to idle after commit phase completes
    this.scheduler.request(() => {
      if (this.current.status === 'committing') {
        this.current = { status: 'idle' }
      }
    })

    return target
  }

  // V4 Task 3.5: Cancel phase with reason
  cancel(reason?: string): void {
    if (this.current.status === 'idle') return

    // Clean up any pending timers
    if (this.current.status === 'pending' && this.current.pressTimer) {
      this.scheduler.cancel(this.current.pressTimer)
    }

    this.current = { status: 'cancelling', reason: reason ?? 'user_cancelled' }

    // Auto-transition to idle after cancel phase completes
    this.scheduler.request(() => {
      if (this.current.status === 'cancelling') {
        this.current = { status: 'idle' }
      }
    })
  }

  // V4 Task 3.5: Force immediate cleanup for cross-root disposal
  dispose(): void {
    if (this.current.status === 'pending' && this.current.pressTimer) {
      this.scheduler.cancel(this.current.pressTimer)
    }
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
