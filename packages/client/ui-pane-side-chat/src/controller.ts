/**
 * Side chat 控制器：侧边对话的生命周期与官方 sessions face 的全部读写。
 *
 * 不变量（spec 级）：
 * 1. 一切读写经 `ISessions.binding()` + `SessionFace`（prompt/cancel/
 *    ConversationSnapshot 订阅）；新建走 runtime `create()` 结构化探测，
 *    fork 走官方 `fork()`。
 * 2. 控制器不持有、也不调用 `sessions.open()/openSubagent()/clear()`——
 *    主对话区 current selection 全程不动（测试断言 open 计数为 0）。
 * 3. close pane = detach：只取消本地订阅，不归档、不终止、不清理 session。
 *
 * @module @yeisme/dsh-client-ui-pane-side-chat/controller
 */

/** 官方 client runtime faces 的结构化子集（与 ISessions/SessionFace 对齐）。 */
export interface SideChatSessionsFace {
  readonly list: {
    getSnapshot(): {
      readonly ids: readonly string[]
      readonly byId: Readonly<Record<string, { displayTitle: string; running: boolean }>>
      readonly current: string | undefined
    }
    subscribe(listener: () => void): () => void
  }
  binding(sessionId: string): SideChatSessionBinding | undefined
  fork(input: { sessionId: string; increaseTitle?: boolean }): Promise<string>
  /** runtime 附加面（ISessions 未声明；缺席即禁用“新建会话”）。 */
  create?(input?: { sessionId?: string }): Promise<string>
}

export interface SideChatSessionBinding {
  readonly sessionId: string
  readonly session: {
    prompt(content: ReadonlyArray<{ type: 'text'; text: string }>, mode: 'queue' | 'steer'): Promise<{ ok: boolean; error?: { message?: string } }>
    cancel(): Promise<{ ok: boolean }>
    loadOlder(): Promise<void>
    subscribe(listener: () => void): () => void
    getSnapshot(): SideChatConversationSnapshot
  }
}

/** ConversationSnapshot 的渲染子集（多余字段原样透传，不复制）。 */
export interface SideChatConversationSnapshot {
  readonly running: boolean
  readonly removed: boolean
  readonly nodes: readonly SideChatNodeLike[]
  readonly queue: readonly unknown[]
  readonly promptError: { message?: string } | null
  readonly hasMore: boolean
  readonly loadingOlder: boolean
}

export interface SideChatNodeLike {
  readonly kind: string
  readonly seq: number
  readonly time?: number | undefined
  readonly content?: ReadonlyArray<{ type?: string; text?: string; kind?: string }> | undefined
  readonly blocks?: ReadonlyArray<{ kind?: string; type?: string; text?: string; name?: string }> | undefined
  readonly turn?: number | undefined
}

export type SideChatPhase = 'empty' | 'attaching' | 'attached' | 'unresolvable'

export interface SideChatState {
  readonly phase: SideChatPhase
  readonly sessionId?: string | undefined
  /** 附着目标的显示名（picker 标题）。 */
  readonly title?: string | undefined
  /** 结构化探测结果：runtime 是否提供 create()。 */
  readonly createAvailable: boolean
  /** 最近一次动作的行内错误（typed 原因；不清空对话）。 */
  readonly error?: string | undefined
  /** promptError 透传（最近一次发送失败）。 */
  readonly promptError?: string | undefined
  /** send 进行中。 */
  readonly sending: boolean
  /** fork/create 进行中。 */
  readonly starting: boolean
}

const EMPTY_STATE: SideChatState = { phase: 'empty', createAvailable: false, sending: false, starting: false }

export class SideChatController {
  private state: SideChatState = EMPTY_STATE
  private readonly listeners = new Set<() => void>()
  private disposeSession: (() => void) | undefined
  private disposed = false

  constructor(private readonly sessions: SideChatSessionsFace) {
    this.state = { ...EMPTY_STATE, createAvailable: typeof sessions.create === 'function' }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = (): SideChatState => this.state

  /** 附着目标的 session face（视图订阅渲染源；未附着 → undefined）。 */
  getSession(): SideChatSessionBinding['session'] | undefined {
    const sessionId = this.state.sessionId
    if (sessionId === undefined) return undefined
    return this.sessions.binding(sessionId)?.session
  }

  dispose(): void {
    this.disposed = true
    this.detach()
    this.listeners.clear()
  }

  private patch(next: Partial<SideChatState>): void {
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener()
  }

  private rebind(sessionId: string): void {
    this.disposeSession?.()
    this.disposeSession = undefined
    const binding = this.sessions.binding(sessionId)
    if (binding === undefined) {
      this.patch({ phase: 'unresolvable', sessionId, error: `session ${sessionId} cannot be resolved for side chat` })
      return
    }
    this.disposeSession = binding.session.subscribe(() => {
      if (this.disposed) return
      const snapshot = binding.session.getSnapshot()
      this.patch({
        promptError: snapshot.promptError?.message,
        sending: false,
      })
    })
  }

  private titleOf(sessionId: string): string {
    return this.sessions.list.getSnapshot().byId[sessionId]?.displayTitle ?? sessionId
  }

  /** 附着既有 session（不切换主选择）。 */
  attach(sessionId: string): void {
    if (this.state.sessionId === sessionId && this.state.phase === 'attached') return
    this.patch({ phase: 'attaching', sessionId, title: this.titleOf(sessionId), error: undefined, promptError: undefined })
    this.rebind(sessionId)
    if (this.sessions.binding(sessionId) !== undefined) {
      this.patch({ phase: 'attached' })
    }
  }

  /** 新建空白 session（runtime create 探测通过才可用；不 open）。 */
  async startNew(): Promise<void> {
    if (this.state.starting || typeof this.sessions.create !== 'function') return
    this.patch({ starting: true, error: undefined })
    try {
      const sessionId = await this.sessions.create()
      if (this.disposed) return
      this.patch({ sessionId, title: this.titleOf(sessionId), error: undefined, promptError: undefined })
      this.rebind(sessionId)
      this.patch({ phase: this.sessions.binding(sessionId) !== undefined ? 'attached' : 'unresolvable', starting: false })
    } catch (error) {
      if (this.disposed) return
      this.patch({ starting: false, error: `create failed: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  /** 从源 session fork 子会话（官方 fork；不 open）。 */
  async forkFrom(sourceSessionId: string): Promise<void> {
    if (this.state.starting) return
    this.patch({ starting: true, error: undefined })
    try {
      const childId = await this.sessions.fork({ sessionId: sourceSessionId, increaseTitle: true })
      if (this.disposed) return
      this.patch({ sessionId: childId, title: this.titleOf(childId), error: undefined, promptError: undefined })
      this.rebind(childId)
      this.patch({ phase: this.sessions.binding(childId) !== undefined ? 'attached' : 'unresolvable', starting: false })
    } catch (error) {
      if (this.disposed) return
      this.patch({ starting: false, error: `fork failed: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  /** 发送消息（running 默认 steer，可显式 queue）。 */
  async send(text: string, mode: 'queue' | 'steer' | 'auto'): Promise<void> {
    const session = this.getSession()
    if (session === undefined || text.length === 0 || this.state.sending) return
    const running = session.getSnapshot().running
    const resolved: 'queue' | 'steer' = mode === 'auto' ? (running ? 'steer' : 'queue') : mode
    this.patch({ sending: true, error: undefined, promptError: undefined })
    const answered = await session.prompt([{ type: 'text', text }], resolved)
    if (this.disposed) return
    if (answered.ok) {
      this.patch({ sending: false })
    } else {
      this.patch({ sending: false, promptError: answered.error?.message ?? 'prompt rejected' })
    }
  }

  /** 取消运行中的 turn。 */
  async cancel(): Promise<void> {
    const session = this.getSession()
    if (session === undefined) return
    const answered = await session.cancel()
    if (this.disposed) return
    if (!answered.ok) this.patch({ error: 'cancel rejected' })
  }

  /** 向后翻页（更早消息）。 */
  async loadOlder(): Promise<void> {
    const session = this.getSession()
    if (session === undefined) return
    await session.loadOlder()
  }

  /** detach：仅取消本地订阅（close pane 路径；session 原样保留）。 */
  detach(): void {
    this.disposeSession?.()
    this.disposeSession = undefined
    this.state = { ...this.state, phase: 'empty', sessionId: undefined, title: undefined, error: undefined, promptError: undefined, sending: false }
    for (const listener of this.listeners) listener()
  }
}
