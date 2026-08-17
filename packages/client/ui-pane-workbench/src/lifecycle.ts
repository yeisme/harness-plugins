import type { PaneViewInstanceV1 } from './workspace.js'

export type PaneViewLifecycleState = 'registered' | 'waiting-for-size' | 'activating' | 'active' | 'suspended' | 'disposed'

export interface PaneViewLifecycleHooks {
  readonly activate: (view: PaneViewInstanceV1) => void
  readonly suspend?: (view: PaneViewInstanceV1) => void
  readonly dispose?: (view: PaneViewInstanceV1) => void
}

export interface PaneAnimationFrame {
  request(callback: () => void): number
  cancel(handle: number): void
}

const browserFrame: PaneAnimationFrame = {
  request: callback => requestAnimationFrame(callback),
  cancel: handle => cancelAnimationFrame(handle),
}

/**
 * Delays size-sensitive activation until two consecutive visible frames. It is
 * DOM-agnostic so browser observers remain a thin adapter around this state machine.
 */
export class PaneViewLifecycleController {
  private state: PaneViewLifecycleState = 'registered'
  private visibleFrames = 0
  private frame?: number
  private projectionVisible = false

  constructor(
    private readonly view: PaneViewInstanceV1,
    private readonly hooks: PaneViewLifecycleHooks,
    private readonly animationFrame: PaneAnimationFrame = browserFrame,
  ) {}

  get snapshot(): PaneViewLifecycleState { return this.state }

  observeSize(width: number, height: number, projectionVisible: boolean): void {
    if (this.state === 'disposed') return
    this.projectionVisible = projectionVisible
    if (!projectionVisible || width <= 0 || height <= 0) {
      this.visibleFrames = 0
      if (this.state === 'active') this.suspend()
      else this.state = 'waiting-for-size'
      return
    }
    if (this.state === 'active') return
    this.state = 'waiting-for-size'
    if (this.frame === undefined) this.frame = this.animationFrame.request(() => this.advanceVisibleFrame(width, height))
  }

  hide(): void {
    this.projectionVisible = false
    this.visibleFrames = 0
    if (this.frame !== undefined) this.animationFrame.cancel(this.frame)
    this.frame = undefined
    if (this.state === 'active') this.suspend()
  }

  close(): void {
    if (this.state === 'disposed') return
    if (this.frame !== undefined) this.animationFrame.cancel(this.frame)
    this.frame = undefined
    this.state = 'disposed'
    this.hooks.dispose?.(this.view)
  }

  private advanceVisibleFrame(width: number, height: number): void {
    this.frame = undefined
    if (!this.projectionVisible || width <= 0 || height <= 0 || this.state === 'disposed') return
    this.visibleFrames += 1
    if (this.visibleFrames < 2) {
      this.frame = this.animationFrame.request(() => this.advanceVisibleFrame(width, height))
      return
    }
    this.state = 'activating'
    this.hooks.activate(this.view)
    this.state = 'active'
  }

  private suspend(): void {
    this.state = 'suspended'
    if (this.view.retention === 'recreate') this.hooks.dispose?.(this.view)
    else this.hooks.suspend?.(this.view)
  }
}
