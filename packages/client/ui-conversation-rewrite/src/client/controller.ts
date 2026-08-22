/**
 * ChatRewriteController：Edit/Retry 的 pending mutation 状态机。
 *
 * 组件只提交 typed intent；fork/prompt/open 由注入的 host adapter 执行。
 * 未知/partial/stale 只进入 typed error，不自动重试。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite/controller
 */

import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { RewriteTarget } from './boundary.ts'

export type ChatRewritePhase = 'idle' | 'submitting' | 'opened' | 'error'

export interface ChatRewriteViewState {
  readonly phase: ChatRewritePhase
  /** 当前 pending/最近一次 action 的稳定 key。 */
  readonly activeKey: string | null
  readonly errorCode: string | null
  readonly errorMessage: string | null
}

export interface ChatRewriteHost {
  /** 非首轮：从已完成 turn 边界 fork child。 */
  fork(opts: { sessionId: SessionId; atSeq: number; increaseTitle?: boolean }): Promise<SessionId>
  /** 首轮（future seam）：forkBeforeMessage 可用时优先使用。 */
  forkBeforeMessage?(opts: { sessionId: SessionId; atMessageSeq: number }): Promise<SessionId>
  /** 向 child 提交编辑/重试后的文本。 */
  prompt(sessionId: SessionId, text: string): Promise<unknown>
  /** 成功后打开 child session。 */
  open(sessionId: SessionId): void
}

/** 最小可观察 snapshot store；不依赖浏览器 runtime，便于 node/jsdom 测试。 */
export interface ChatRewriteSnapshotStore {
  getSnapshot(): ChatRewriteViewState
  subscribe(fn: () => void): () => void
  set(next: ChatRewriteViewState): void
}

class SnapshotStoreImpl implements ChatRewriteSnapshotStore {
  private state: ChatRewriteViewState
  private readonly listeners = new Set<() => void>()

  constructor(init: ChatRewriteViewState) {
    this.state = init
  }

  getSnapshot(): ChatRewriteViewState {
    return this.state
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  set(next: ChatRewriteViewState): void {
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }
}

const INITIAL: ChatRewriteViewState = {
  phase: 'idle',
  activeKey: null,
  errorCode: null,
  errorMessage: null,
}

function errorDetails(error: unknown): { code: string; message: string } {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown }
    return {
      code: typeof candidate.code === 'string' ? candidate.code : 'mutation_failed',
      message: typeof candidate.message === 'string' ? candidate.message : 'Conversation rewrite mutation failed',
    }
  }
  return { code: 'mutation_failed', message: 'Conversation rewrite mutation failed' }
}

/** 一个 effect-scoped 的轻量 mutation 控制器；dispose 后不再发布状态。 */
export class ChatRewriteController {
  readonly store: ChatRewriteSnapshotStore = new SnapshotStoreImpl(INITIAL)

  private active: Promise<void> | undefined
  private disposed = false

  constructor(private readonly host: ChatRewriteHost) {}

  /** True when the host bound `session.forkBeforeMessage`. */
  supportsFirstRound(): boolean {
    return this.host.forkBeforeMessage !== undefined
  }

  /** 发起一次 Edit/Retry 派生。同一时刻只允许一个 pending mutation。 */
  run(sessionId: SessionId, target: RewriteTarget): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (this.store.getSnapshot().phase === 'submitting') return this.active ?? Promise.resolve()

    this.store.set({ phase: 'submitting', activeKey: target.key, errorCode: null, errorMessage: null })
    const operation = this.execute(sessionId, target).finally(() => {
      if (this.active === operation) this.active = undefined
    })
    this.active = operation
    return operation
  }

  /** 清除 error/opened 状态，回到 idle。 */
  reset(): void {
    if (!this.disposed) this.store.set(INITIAL)
  }

  /** 插件卸载：若仍有 pending，则以 settled error 收敛，不留下幽灵 pending。 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const current = this.store.getSnapshot()
    if (current.phase === 'submitting') {
      this.store.set({
        phase: 'error',
        activeKey: current.activeKey,
        errorCode: 'disposed',
        errorMessage: 'Plugin unloaded before the mutation settled',
      })
    } else {
      this.store.set(INITIAL)
    }
    this.active = undefined
  }

  private async execute(sessionId: SessionId, target: RewriteTarget): Promise<void> {
    try {
      const childId = await this.forkChild(sessionId, target)
      await this.host.prompt(childId, target.text)
      this.host.open(childId)
      if (!this.disposed) {
        this.store.set({ phase: 'opened', activeKey: target.key, errorCode: null, errorMessage: null })
      }
    } catch (error) {
      if (!this.disposed) {
        const details = errorDetails(error)
        this.store.set({ phase: 'error', activeKey: target.key, errorCode: details.code, errorMessage: details.message })
      }
    }
  }

  private async forkChild(sessionId: SessionId, target: RewriteTarget): Promise<SessionId> {
    if (target.boundarySeq !== null) {
      return this.host.fork({ sessionId, atSeq: target.boundarySeq, increaseTitle: true })
    }
    if (this.host.forkBeforeMessage !== undefined) {
      return this.host.forkBeforeMessage({ sessionId, atMessageSeq: target.seq })
    }
    throw new Error('forkBeforeMessage is unavailable for first-round rewrite')
  }
}

/** @deprecated alias 保持与 task 2.2 的 Retry/Edit 命名一致。 */
export const ChatRewritePhaseEnum = {
  Idle: 'idle',
  Submitting: 'submitting',
  Opened: 'opened',
  Error: 'error',
} as const satisfies Record<string, ChatRewritePhase>
