import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { OrdoAgentOpsSnapshot } from './contracts.ts'
import { OrdoAgentOpsCursor } from './cursor.ts'

/** Browser 读取状态；canonical Agent Ops facts 始终留在 Host/Ordo。 */
export type OrdoAgentOpsReadPhase = 'cold' | 'loading' | 'ready' | 'error'

/** sidebar 消费的最小展示状态。 */
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

/** 一次 bounded、generation-aware 的 Host projection 读取生命周期。 */
export class OrdoAgentOpsController {
  readonly store: SnapshotStore<OrdoAgentOpsViewState> = createSnapshotStore(INITIAL)

  private generation = 0
  private active: Promise<void> | undefined
  private disposed = false
  private readonly cursor = new OrdoAgentOpsCursor()

  constructor(private readonly remote: SnapshotRemote) {}

  /** 同一 generation 的并发刷新共用一个请求。 */
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

  /**
   * 连接 reset 必须令旧异步应答失效，再从新的权威 snapshot 重建 UI 状态。
   */
  reset(): void {
    this.generation += 1
    this.active = undefined
    this.cursor.reset()
    if (!this.disposed) this.store.set(INITIAL)
  }

  /** 卸载后不再接受 Remote 应答，且不保留上一 runtime 的任何展示事实。 */
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
      this.publish(generation, { phase: 'error', snapshot: null, errorCode: result.error.code })
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
