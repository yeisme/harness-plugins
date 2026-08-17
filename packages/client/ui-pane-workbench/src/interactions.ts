import type { PaneSplitEdge } from './workspace.js'

export const PANE_DRAG_THRESHOLD_PX = 6

export interface PaneDragTargetV1 {
  readonly groupId: string
  readonly edge: 'center' | PaneSplitEdge
  readonly enabled: boolean
  readonly reason?: string
}

export type PaneDragStateV1 =
  | { readonly status: 'idle' }
  | { readonly status: 'pending'; readonly viewId: string; readonly x: number; readonly y: number }
  | { readonly status: 'dragging'; readonly viewId: string; readonly target?: PaneDragTargetV1 }

/** Pointer sensor with an explicit cleanup path for Escape, blur, cancel, and HMR disposal. */
export class PaneDragSession {
  private current: PaneDragStateV1 = { status: 'idle' }

  get state(): PaneDragStateV1 { return this.current }

  begin(viewId: string, x: number, y: number): void { this.current = { status: 'pending', viewId, x, y } }

  move(x: number, y: number, target?: PaneDragTargetV1): PaneDragStateV1 {
    if (this.current.status === 'pending') {
      if (Math.hypot(x - this.current.x, y - this.current.y) < PANE_DRAG_THRESHOLD_PX) return this.current
      this.current = { status: 'dragging', viewId: this.current.viewId, target }
      return this.current
    }
    if (this.current.status === 'dragging') this.current = { ...this.current, target }
    return this.current
  }

  drop(): PaneDragTargetV1 | undefined {
    const target = this.current.status === 'dragging' ? this.current.target : undefined
    this.current = { status: 'idle' }
    return target?.enabled ? target : undefined
  }

  cancel(): void { this.current = { status: 'idle' } }
}

/** Pointermove only previews through a callback; a single reducer value is committed on pointerup. */
export class PaneResizeSession {
  private latest?: number
  private resizing = false

  constructor(private readonly preview: (ratio: number | undefined) => void, private readonly commit: (ratio: number) => void) {}

  begin(): void { this.resizing = true; this.latest = undefined; this.preview(undefined) }
  move(ratio: number): void { if (this.resizing) { this.latest = ratio; this.preview(ratio) } }
  end(ratio?: number): void {
    if (!this.resizing) return
    const finalRatio = ratio ?? this.latest
    this.resizing = false
    this.preview(undefined)
    if (finalRatio !== undefined) this.commit(finalRatio)
  }
  cancel(): void { this.resizing = false; this.latest = undefined; this.preview(undefined) }
}
