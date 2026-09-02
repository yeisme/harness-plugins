/**
 * ChatRewriteController：Edit/Retry 的 pending mutation 状态机（V2 core facade）。
 *
 * 分阶段执行、single-flight、dispose 收敛与 partial-success 安全不变量全部由
 * `@yeisme/dsh-client-ui-conversation-rewrite-core` 的 V2 controller 拥有；本
 * facade 只做两件事：把旧 `ChatRewriteHost` 适配为 V2 mutation host，并把
 * V2 阶段投影回旧视图 `idle | submitting | opened | error`。旧 store 形状、
 * Promise 汇合与 dispose 语义保持不变。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite/controller
 */

import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import {
  ConversationRewriteControllerV2,
  accepted,
  rejected,
  unknownOutcome,
  type RewriteMutationHostV2,
  type RewriteMutationOutcomeV2,
} from '@yeisme/dsh-client-ui-conversation-rewrite-core'
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

  readonly getSnapshot = (): ChatRewriteViewState => this.state

  readonly subscribe = (fn: () => void): (() => void) => {
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

/** V1 host throw 分类：携带稳定 code 的对象视为确定性拒绝，其余一律 unknown。 */
async function classify<T>(code: string, call: () => Promise<T>): Promise<RewriteMutationOutcomeV2<T>> {
  try {
    const value = await call()
    return accepted(value)
  } catch (error) {
    if (typeof error === 'object' && error !== null) {
      const candidate = error as { code?: unknown; message?: unknown }
      const errorCode = typeof candidate.code === 'string' ? candidate.code : null
      const message = typeof candidate.message === 'string' ? candidate.message : undefined
      // rejected/unknownOutcome 默认 T=never：这里显式断言回调用点的值类型。
      if (errorCode !== null) return rejected(errorCode, message) as RewriteMutationOutcomeV2<T>
      return unknownOutcome(code, undefined, message) as RewriteMutationOutcomeV2<T>
    }
    return unknownOutcome(code) as RewriteMutationOutcomeV2<T>
  }
}

/** 旧 host → V2 mutation host：open 映射 activate 阶段。 */
function toV2Host(host: ChatRewriteHost): RewriteMutationHostV2 {
  const forkBeforeMessage = host.forkBeforeMessage
  return {
    fork: (input) =>
      classify('fork_error', async () => ({ childSessionId: String(await host.fork({ sessionId: input.sourceSessionId as SessionId, atSeq: input.boundarySeq, increaseTitle: true })) })),
    ...(forkBeforeMessage !== undefined
      ? {
          forkBeforeMessage: (input: { operationId: string; sourceSessionId: string; messageSeq: number }) =>
            classify('fork_error', async () => ({ childSessionId: String(await forkBeforeMessage({ sessionId: input.sourceSessionId as SessionId, atMessageSeq: input.messageSeq })) })),
        }
      : {}),
    prompt: (input) =>
      classify('prompt_error', async () => {
        await host.prompt(input.childSessionId as SessionId, input.text)
        return {} as Record<string, never>
      }),
    activate: (input) =>
      classify('activate_error', async () => {
        host.open(input.childSessionId as SessionId)
        return {} as Record<string, never>
      }),
  }
}

/** 一个 effect-scoped 的轻量 mutation 控制器；dispose 后不再发布状态。 */
export class ChatRewriteController {
  readonly store: ChatRewriteSnapshotStore = new SnapshotStoreImpl(INITIAL)

  private readonly core: ConversationRewriteControllerV2
  private pending: Promise<void> | undefined
  private disposed = false
  private operationCounter = 0

  constructor(private readonly host: ChatRewriteHost) {
    this.core = new ConversationRewriteControllerV2(toV2Host(host))
    this.core.store.subscribe(() => this.project())
  }

  /** True when the host bound `session.forkBeforeMessage`. */
  supportsFirstRound(): boolean {
    return this.host.forkBeforeMessage !== undefined
  }

  /** 发起一次 Edit/Retry 派生。同一时刻只允许一个 pending mutation。 */
  run(sessionId: SessionId, target: RewriteTarget): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (this.pending !== undefined) return this.pending

    // 首轮 fail closed：保持 V1 的错误码与消息，零 owner 调用。
    if (target.boundarySeq === null && this.host.forkBeforeMessage === undefined) {
      this.store.set({
        phase: 'error',
        activeKey: target.key,
        errorCode: 'mutation_failed',
        errorMessage: 'forkBeforeMessage is unavailable for first-round rewrite',
      })
      return Promise.resolve()
    }

    const operation = this.core
      .run({
        operationId: `web-rewrite:${target.key}:${(this.operationCounter += 1)}`,
        target: {
          kind: target.kind,
          key: target.key,
          sourceSessionId: String(sessionId),
          sourceGeneration: 0,
          messageKey: `web:${target.key}`,
          messageSeq: target.seq,
          boundarySeq: target.boundarySeq,
          text: target.text,
        },
      })
      .then(() => undefined)
      .finally(() => {
        if (this.pending === operation) this.pending = undefined
      })
    this.pending = operation
    return operation
  }

  /** 清除 error/opened 状态，回到 idle。 */
  reset(): void {
    if (this.disposed) return
    this.core.reset()
    if (this.pending === undefined) this.store.set(INITIAL)
  }

  /** 插件卸载：若仍有 pending，则以 settled error 收敛，不留下幽灵 pending。 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.core.dispose()
    this.pending = undefined
  }

  /** V2 阶段 → 旧视图相位（forking…hydrating → submitting；succeeded → opened）。 */
  private project(): void {
    const state = this.core.store.getSnapshot()
    switch (state.phase) {
      case 'idle':
        this.store.set(INITIAL)
        return
      case 'forking':
      case 'prompting':
      case 'activating':
      case 'hydrating':
        this.store.set({ phase: 'submitting', activeKey: state.targetKey, errorCode: null, errorMessage: null })
        return
      case 'succeeded':
        this.store.set({ phase: 'opened', activeKey: state.targetKey, errorCode: null, errorMessage: null })
        return
      case 'recoverable_error':
        this.store.set({
          phase: 'error',
          activeKey: state.targetKey,
          errorCode: state.reasonCode,
          errorMessage: state.safeSummary ?? 'Conversation rewrite mutation failed',
        })
    }
  }
}

/** @deprecated alias 保持与 task 2.2 的 Retry/Edit 命名一致。 */
export const ChatRewritePhaseEnum = {
  Idle: 'idle',
  Submitting: 'submitting',
  Opened: 'opened',
  Error: 'error',
} as const satisfies Record<string, ChatRewritePhase>
