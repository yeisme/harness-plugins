import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { OrdoAgentOpsSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { OrdoAgentOpsCursor } from './cursor.ts'

/** Browser-owned read lifecycle; canonical Agent Ops facts stay in the Host. */
export type OrdoAgentOpsReadPhase = 'cold' | 'loading' | 'ready' | 'error'

/** State presented by the compact panel. */
export interface OrdoAgentOpsViewState {
  readonly phase: OrdoAgentOpsReadPhase
  readonly snapshot: OrdoAgentOpsSnapshot | null
  readonly errorCode: string | null
}

type SnapshotRemote = {
  snapshot: () => Promise<RemoteResult<OrdoAgentOpsSnapshot>>
}

const INITIAL: OrdoAgentOpsViewState = {
  phase: 'cold',
  snapshot: null,
  errorCode: null,
}

/** Owns one bounded, generation-aware snapshot read for the DSH panel. */
export class OrdoAgentOpsController {
  /** Observable view state consumed by the panel hook binding. */
  readonly store: SnapshotStore<OrdoAgentOpsViewState> = createSnapshotStore(INITIAL)

  private generation = 0
  private active: Promise<void> | undefined
  private disposed = false
  private readonly cursor = new OrdoAgentOpsCursor()

  /**
   * @param remote - typed Host Remote namespace.
   */
  constructor(private readonly remote: SnapshotRemote) {}

  /** Read once per generation; concurrent panel refreshes share one operation. */
  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (this.active !== undefined) return this.active
    const generation = this.generation
    const previous = this.store.getSnapshot().snapshot
    this.store.set({ phase: 'loading', snapshot: previous, errorCode: null })
    const operation = this.read(generation).finally(() => {
      if (this.active === operation) this.active = undefined
    })
    this.active = operation
    return operation
  }

  /** Drop the current Host generation; late answers cannot repopulate the panel. */
  reset(): void {
    this.generation += 1
    this.active = undefined
    this.cursor.reset()
    if (!this.disposed) this.store.set(INITIAL)
  }

  /** Stop accepting late Remote answers and clear the read state. */
  dispose(): void {
    this.disposed = true
    this.generation += 1
    this.active = undefined
    this.cursor.reset()
    this.store.set(INITIAL)
  }

  private async read(generation: number): Promise<void> {
    let result: RemoteResult<OrdoAgentOpsSnapshot>
    try {
      result = await this.remote.snapshot()
    } catch {
      this.publish(generation, { phase: 'error', snapshot: null, errorCode: 'remote_read_failed' })
      return
    }
    if (!this.current(generation)) return
    if (!result.ok) {
      this.publish(generation, {
        phase: 'error',
        snapshot: null,
        errorCode: result.error.code,
      })
      return
    }
    const value = result.value
    if (value.state === 'ready' || value.state === 'stale') {
      const decision = this.cursor.apply(value)
      if (decision === 'duplicate') {
        this.publish(generation, { phase: 'ready', snapshot: this.store.getSnapshot().snapshot, errorCode: null })
        return
      }
      if (decision === 'drift') {
        this.publish(generation, { phase: 'error', snapshot: null, errorCode: 'owner_cursor_drift' })
        return
      }
    }
    this.publish(generation, { phase: 'ready', snapshot: value, errorCode: null })
  }

  private publish(generation: number, state: OrdoAgentOpsViewState): void {
    if (this.current(generation)) this.store.set(state)
  }

  private current(generation: number): boolean {
    return !this.disposed && this.generation === generation
  }
}
