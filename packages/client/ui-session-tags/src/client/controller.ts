/**
 * Generation-aware snapshot controller：`sessionTags.list` 的唯一 Client 缓存。
 *
 * 异步状态机不变量（全部有测试钉住）：
 * 1. 每次刷新分配单调递增的 generation；旧 generation 的应答一律丢弃
 *    ——连接 reset 后返回的旧 `list` 结果绝不能覆盖新连接的 snapshot。
 * 2. in-flight fold（单飞泵）：同一时刻至多一个 Remote `list` 在途；
 *    在途期间新到的 refresh 合并为泵的下一次迭代，不叠加并发请求。
 * 3. 错误状态不伪造 tags：`error` 态不携带任何行；provider 在非 ready
 *    态不产出分组（宁可空，不可假）。
 * 4. dispose 后忽略一切应答、解决全部 waiter、清空订阅；后续 refresh()
 *    变为 no-op（卸载后的 store 清理，无悬挂回调）。
 *    ready 态重读不回退 loading：保留上一次权威快照直到新应答到达。
 * 5. 快照引用稳定：状态对象只在变化时重建，getSnapshot() 在两次通知
 *    之间返回同一引用（外部 store 源合同）。
 * 6. 这是投影缓存，不是第二份 canonical store：tag 的权威值永远在
 *    Host sidecar；本 controller 只缓存最近一次权威 `list` 应答。
 *
 * 刷新触发（V1 边界）：初次挂载、连接 reset、窗口重新聚焦、自身写入成功。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/controller
 */

import type {
  SessionTagsListAnswerV1,
  SessionTagsListEntryV1,
  SessionTagsRemoteFace,
} from './wire.ts'

/** controller 的外部可见状态。 */
export type SessionTagsControllerState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly specVersion: '1.0'; readonly entries: readonly SessionTagsListEntryV1[] }
  | { readonly status: 'error'; readonly message: string }

/** controller 构造依赖。 */
export interface SessionTagsControllerDeps {
  readonly remote: SessionTagsRemoteFace
}

const IDLE: SessionTagsControllerState = Object.freeze({ status: 'idle' })
const LOADING: SessionTagsControllerState = Object.freeze({ status: 'loading' })

/**
 * sessionTags list 的 generation-aware 控制器。
 * 通过 getSnapshot/subscribe 表现为稳定的外部 store 源。
 */
export class SessionTagsController {
  private readonly remote: SessionTagsRemoteFace
  private state: SessionTagsControllerState = IDLE
  private readonly listeners = new Set<() => void>()
  /** 最新请求代（每次 refresh 递增）。 */
  private generation = 0
  /** 已完成读取的代（泵的服务水位）。 */
  private served = 0
  /** 等待各自 generation 被服务（或被超越）的 refresh 调用方。 */
  private readonly waiters: Array<{ readonly generation: number; readonly resolve: () => void }> = []
  /** 泵在跑标志：同一时刻至多一个在途 `list`。 */
  private running = false
  private disposed = false

  constructor(deps: SessionTagsControllerDeps) {
    this.remote = deps.remote
  }

  /** 当前状态（两次通知之间引用稳定）。 */
  getSnapshot(): SessionTagsControllerState {
    return this.state
  }

  /** 订阅状态变化；返回退订函数。 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 是否处于可派生分组的 ready 态。 */
  isReady(): boolean {
    return this.state.status === 'ready'
  }

  /** ready 态下按 SessionId 取行（无标签或非 ready 返回 undefined）。 */
  rowOf(sessionId: string): SessionTagsListEntryV1 | undefined {
    if (this.state.status !== 'ready') return undefined
    return this.state.entries.find(entry => entry.sessionId === sessionId)
  }

  /** ready 态下的全部行条目（冻结投影）。 */
  entries(): readonly SessionTagsListEntryV1[] {
    return this.state.status === 'ready' ? this.state.entries : []
  }

  /**
   * 请求一次刷新。返回的 promise 在“该 generation 已被服务或已被更新代
   * 取代”时解决；调用方不应依赖返回时序读状态，一律读 getSnapshot()。
   */
  refresh(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const generation = ++this.generation
    // 只在 idle 时进入 loading：ready 态重读期间保留上一次权威快照
    //（不闪空、不伪造——数据仍来自上一次权威应答）。
    if (this.state.status === 'idle') this.setState(LOADING)
    const promise = new Promise<void>(resolve => {
      this.waiters.push({ generation, resolve })
    })
    void this.pump()
    return promise
  }

  /** 连接 reset：作废在途期望并重读权威态。 */
  onConnectionReset(): Promise<void> {
    return this.refresh()
  }

  /** 窗口重新聚焦：重读（跨标签页写入的陈旧窗口有界）。 */
  onWindowFocus(): Promise<void> {
    return this.refresh()
  }

  /** 自身写入成功后：重读（拿到权威行 + 他人并发写入）。 */
  afterOwnWrite(): Promise<void> {
    return this.refresh()
  }

  /** 卸载：忽略一切后续应答、解决 waiter、清空订阅并回到 idle。 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const waiters = this.waiters.splice(0)
    for (const waiter of waiters) waiter.resolve()
    this.listeners.clear()
    this.state = IDLE
  }

  /**
   * 单飞泵：服务到最新 generation 为止。在途请求完成时若又有新代到达，
   * 循环自然再跑一轮（in-flight fold 到恰好一次补读）。
   */
  private async pump(): Promise<void> {
    if (this.running || this.disposed) return
    this.running = true
    try {
      while (!this.disposed && this.served < this.generation) {
        // 迭代起点先让出一个微任务：同一同步批次内的多次 refresh 全部
        // 落定后再取最新代，确保这批触发折叠为恰好一次读取。
        await Promise.resolve()
        const generation = this.generation
        await this.issue(generation)
        this.served = Math.max(this.served, generation)
        this.releaseWaiters()
      }
    } finally {
      this.running = false
    }
  }

  /** 发出一次 `list`；应答只在仍为最新代时被采纳。 */
  private async issue(generation: number): Promise<void> {
    let answer: SessionTagsListAnswerV1
    try {
      answer = await this.remote.list()
    } catch (error) {
      this.accept(generation, { status: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }
    if (answer.ok) {
      this.accept(generation, {
        status: 'ready',
        specVersion: answer.specVersion,
        entries: Object.freeze([...answer.entries]),
      })
    } else {
      this.accept(generation, { status: 'error', message: answer.message })
    }
  }

  /** 采纳应答：落后代直接丢弃（核心不变量 1）。 */
  private accept(generation: number, next: SessionTagsControllerState): void {
    if (this.disposed || generation !== this.generation) return
    this.setState(next)
  }

  /** 解决已服务（或已被超越）的 waiter。 */
  private releaseWaiters(): void {
    for (let i = this.waiters.length - 1; i >= 0; i -= 1) {
      const waiter = this.waiters[i]
      if (waiter === undefined) continue
      if (waiter.generation <= this.served || waiter.generation < this.generation) {
        this.waiters.splice(i, 1)
        waiter.resolve()
      }
    }
  }

  private setState(next: SessionTagsControllerState): void {
    if (this.state === next) return
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }
}

/** 构造 controller。 */
export function createSessionTagsController(deps: SessionTagsControllerDeps): SessionTagsController {
  return new SessionTagsController(deps)
}
