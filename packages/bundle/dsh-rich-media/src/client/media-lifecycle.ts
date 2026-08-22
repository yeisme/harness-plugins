/**
 * Media view lifecycle (V3 5.7, differentiation lane): inactive views pause
 * playback instead of hiding it; suspend/activate keeps only bounded memory
 * (currentTime and zoom level, never buffers or decoded frames); release
 * evicts everything; expired access handles re-resolve through the owner
 * host. Pure state machine — no DOM, fully testable.
 *
 * @module @yeisme/dsh-rich-media/client
 */

export type MediaLifecyclePhase = 'active' | 'suspended' | 'released'

/** Bounded per-resource memory kept across suspend/move. */
export interface BoundedMediaMemory {
  /** Last playback position in seconds, when the resource was playing. */
  currentTime?: number | undefined
  /** Last image zoom level. */
  zoom?: number | undefined
}

export class MediaLifecycleError extends Error {
  override readonly name = 'MediaLifecycleError'
  constructor(readonly code: 'already_released' | 'not_suspended', message: string) {
    super(message)
  }
}

/** Lifecycle state machine for one media view instance. */
export class MediaLifecycleController {
  private phase: MediaLifecyclePhase = 'active'
  private memory: BoundedMediaMemory = {}
  private resolveCount = 0

  /** Current phase. */
  get state(): MediaLifecyclePhase { return this.phase }

  /** How many times access was (re-)resolved; grows on expiry re-resolve. */
  get accessResolutions(): number { return this.resolveCount }

  /** Record one successful owner access resolution. */
  recordAccess(): void {
    if (this.phase === 'released') throw new MediaLifecycleError('already_released', 'released views resolve no access')
    this.resolveCount += 1
  }

  /** Suspend: pause playback and keep only bounded memory. */
  suspend(memory: BoundedMediaMemory = {}): BoundedMediaMemory {
    if (this.phase === 'released') throw new MediaLifecycleError('already_released', 'released views cannot suspend')
    this.phase = 'suspended'
    this.memory = {
      ...memory.currentTime === undefined ? {} : { currentTime: memory.currentTime },
      ...memory.zoom === undefined ? {} : { zoom: memory.zoom },
    }
    return this.memory
  }

  /** Activate: restore bounded memory; a released view stays released. */
  activate(): BoundedMediaMemory {
    if (this.phase === 'released') throw new MediaLifecycleError('already_released', 'released views cannot activate')
    const restored = this.phase === 'suspended' ? this.memory : {}
    this.phase = 'active'
    return restored
  }

  /** An access handle expired while active: re-resolve through the owner. */
  handleExpired(): 're-resolve' {
    if (this.phase === 'released') throw new MediaLifecycleError('already_released', 'released views re-resolve nothing')
    return 're-resolve'
  }

  /** Release: evict all state; terminal. */
  release(): void {
    this.phase = 'released'
    this.memory = {}
  }

  /**
   * Wire visibility: a hidden or zero-size host suspends; a visible host
   * activates. Released controllers stay released.
   */
  applyVisibility(visible: boolean, memory: BoundedMediaMemory = {}): MediaLifecyclePhase {
    if (this.phase === 'released') return this.phase
    if (visible) {
      this.activate()
    } else {
      this.suspend(memory)
    }
    return this.phase
  }
}
