/**
 * ConversationRewriteControllerV2：分阶段 single-flight mutation 状态机。
 *
 * 组件/宿主只提交 typed request；fork → prompt → activate → hydrate? 由注入的
 * host adapter 执行。core 的安全不变量：
 * - 一个 controller 同时只有一个 operation；并发的第二个 run 返回同一 Promise；
 * - 任一 rejected/unknown 收敛为 recoverable_error，永不自动重试/重发/补偿；
 * - child ID 一旦已知即保留在 state 中，供 UI 做 Inspect/Open/Retry-activation；
 * - observable state / receipt 永不包含 prompt 文本（sentinel 测试守护）；
 * - dispose 只阻止后续发布并收敛 state，不发起 cancel/delete/补偿 mutation。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite-core
 */

import { accepted, normalizeRewriteSafeSummary, rejected, unknownOutcome, type RewriteMutationOutcomeV2 } from './outcome.ts'
import type { RewriteTargetV2 } from './types.ts'

/** fork 成功的最小事实：child session ID。 */
export interface RewriteForkValueV2 {
  readonly childSessionId: string
}

/** 无附加数据的阶段（prompt/activate/hydrate）统一空值。 */
export type RewriteUnitValueV2 = Record<string, never>

/**
 * Owner mutation 契约：每个方法都必须返回 typed outcome；未分类 throw 由
 * controller 统一按 unknown 处理。方法缺省（forkBeforeMessage/hydrate）即能力
 * 缺席，controller 对应分支 fail closed。
 */
export interface RewriteMutationHostV2 {
  fork(input: {
    readonly operationId: string
    readonly sourceSessionId: string
    readonly boundarySeq: number
  }): Promise<RewriteMutationOutcomeV2<RewriteForkValueV2>>

  forkBeforeMessage?(input: {
    readonly operationId: string
    readonly sourceSessionId: string
    readonly messageSeq: number
  }): Promise<RewriteMutationOutcomeV2<RewriteForkValueV2>>

  prompt(input: {
    readonly operationId: string
    readonly childSessionId: string
    readonly text: string
  }): Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>

  activate(input: {
    readonly operationId: string
    readonly childSessionId: string
  }): Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>

  hydrate?(input: {
    readonly operationId: string
    readonly childSessionId: string
  }): Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>
}

export interface RewriteRunRequestV2 {
  readonly operationId: string
  readonly target: RewriteTargetV2
}

export type RewriteOperationPhaseV2 =
  | 'idle'
  | 'forking'
  | 'prompting'
  | 'activating'
  | 'hydrating'
  | 'succeeded'
  | 'recoverable_error'

/** 失败发生在 pipeline 的哪个阶段。 */
export type RewriteFailureStageV2 = 'fork' | 'prompt' | 'activate' | 'hydrate'

/**
 * Recovery receipt 本体：只有 ID/阶段/结果/原因/bounded safe summary。
 * prompt 文本只存在于调用栈闭包，settlement 后随闭包释放。
 */
export interface RewriteOperationStateV2 {
  readonly phase: RewriteOperationPhaseV2
  readonly operationId: string | null
  readonly targetKey: string | null
  readonly sourceSessionId: string | null
  readonly sourceGeneration: number | null
  readonly childSessionId: string | null
  readonly failureStage: RewriteFailureStageV2 | null
  readonly outcome: 'rejected' | 'unknown' | 'stale' | null
  readonly reasonCode: string | null
  readonly safeSummary: string | null
}

/** 最小可观察 snapshot store；不依赖任何浏览器/Node runtime。 */
export interface RewriteOperationSnapshotStoreV2 {
  getSnapshot(): RewriteOperationStateV2
  subscribe(fn: () => void): () => void
  set(next: RewriteOperationStateV2): void
}

class SnapshotStoreImpl implements RewriteOperationSnapshotStoreV2 {
  private state: RewriteOperationStateV2
  private readonly listeners = new Set<() => void>()

  constructor(init: RewriteOperationStateV2) {
    this.state = init
  }

  readonly getSnapshot = (): RewriteOperationStateV2 => this.state

  readonly subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  set(next: RewriteOperationStateV2): void {
    this.state = next
    for (const listener of [...this.listeners]) listener()
  }
}

const IDLE_STATE: RewriteOperationStateV2 = {
  phase: 'idle',
  operationId: null,
  targetKey: null,
  sourceSessionId: null,
  sourceGeneration: null,
  childSessionId: null,
  failureStage: null,
  outcome: null,
  reasonCode: null,
  safeSummary: null,
}

interface OperationBase {
  readonly operationId: string
  readonly targetKey: string
  readonly sourceSessionId: string
  readonly sourceGeneration: number
}

/** 一个 effect-scoped 的 V2 mutation controller。 */
export class ConversationRewriteControllerV2 {
  readonly store: RewriteOperationSnapshotStoreV2 = new SnapshotStoreImpl(IDLE_STATE)

  private active: Promise<RewriteOperationStateV2> | undefined
  private disposed = false
  /** 当前活跃 operation 的内部令牌：只有令牌匹配的迟到结果才能发布状态。 */
  private activeToken = 0

  constructor(private readonly host: RewriteMutationHostV2) {}

  /**
   * 发起一次 rewrite 派生。同一时刻只执行一个 operation：活跃期间的重复
   * run 直接返回同一 Promise，不产生第二个 fork/prompt。
   */
  run(request: RewriteRunRequestV2): Promise<RewriteOperationStateV2> {
    if (this.disposed) return Promise.resolve(this.store.getSnapshot())
    if (this.active !== undefined) return this.active

    const token = this.activeToken + 1
    this.activeToken = token
    const operation = this.execute(request, token).finally(() => {
      if (this.activeToken === token) this.active = undefined
    })
    this.active = operation
    return operation
  }

  /** 清除 error/succeeded 状态回到 idle；活跃 operation 不受影响。 */
  reset(): void {
    if (this.disposed) return
    if (this.active === undefined) this.store.set(IDLE_STATE)
  }

  /**
   * 插件卸载/组件销毁：若仍有 pending，以 recoverable_error(stale/disposed)
   * 收敛，不留下幽灵 pending；之后的迟到 owner 结果不再发布成功状态。
   */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const current = this.store.getSnapshot()
    if (this.active !== undefined) {
      this.store.set({
        ...current,
        phase: 'recoverable_error',
        failureStage: this.stageOfPhase(current.phase),
        outcome: 'stale',
        reasonCode: 'disposed',
        safeSummary: 'Controller disposed before the operation settled',
      })
    } else {
      this.store.set(IDLE_STATE)
    }
    this.active = undefined
  }

  private stageOfPhase(phase: RewriteOperationPhaseV2): RewriteFailureStageV2 | null {
    switch (phase) {
      case 'forking':
        return 'fork'
      case 'prompting':
        return 'prompt'
      case 'activating':
        return 'activate'
      case 'hydrating':
        return 'hydrate'
      default:
        return null
    }
  }

  /** dispose/换代后禁止再发布；state 只能由当前令牌推进。 */
  private publish(token: number, next: RewriteOperationStateV2): boolean {
    if (this.disposed || this.activeToken !== token) return false
    this.store.set(next)
    return true
  }

  private async execute(request: RewriteRunRequestV2, token: number): Promise<RewriteOperationStateV2> {
    const { target } = request
    const base: OperationBase = {
      operationId: request.operationId,
      targetKey: target.key,
      sourceSessionId: target.sourceSessionId,
      sourceGeneration: target.sourceGeneration,
    }
    const neutral = {
      childSessionId: null,
      failureStage: null,
      outcome: null,
      reasonCode: null,
      safeSummary: null,
    } as const

    // ── fork / forkBeforeMessage ────────────────────────────────────────────
    if (!this.publish(token, { ...base, ...neutral, phase: 'forking' })) return this.store.getSnapshot()

    const forkOutcome =
      target.boundarySeq !== null
        ? await this.callHost(
            this.host.fork({ operationId: request.operationId, sourceSessionId: target.sourceSessionId, boundarySeq: target.boundarySeq }),
          )
        : this.host.forkBeforeMessage !== undefined
          ? await this.callHost(
              this.host.forkBeforeMessage({ operationId: request.operationId, sourceSessionId: target.sourceSessionId, messageSeq: target.messageSeq }),
            )
          : rejected<RewriteForkValueV2>('fork_before_message_unavailable')

    if (forkOutcome.kind !== 'accepted') {
      // fork unknown 时保留 partial 中已知 child ID，供 Refresh/Inspect 恢复路径。
      const partialChild = forkOutcome.kind === 'unknown' ? forkOutcome.partial?.childSessionId : undefined
      return this.fail(token, base, partialChild ?? null, 'fork', forkOutcome.kind, forkOutcome.code, forkOutcome.summary)
    }
    const childSessionId: string = forkOutcome.value.childSessionId

    // ── prompt ──────────────────────────────────────────────────────────────
    if (!this.publish(token, { ...base, phase: 'prompting', childSessionId, failureStage: null, outcome: null, reasonCode: null, safeSummary: null })) {
      return this.store.getSnapshot()
    }
    const promptOutcome = await this.callHost(
      this.host.prompt({ operationId: request.operationId, childSessionId, text: target.text }),
    )
    if (promptOutcome.kind !== 'accepted') {
      return this.fail(token, base, childSessionId, 'prompt', promptOutcome.kind, promptOutcome.code, promptOutcome.summary)
    }

    // ── activate ────────────────────────────────────────────────────────────
    if (!this.publish(token, { ...base, phase: 'activating', childSessionId, failureStage: null, outcome: null, reasonCode: null, safeSummary: null })) {
      return this.store.getSnapshot()
    }
    const activateOutcome = await this.callHost(
      this.host.activate({ operationId: request.operationId, childSessionId }),
    )
    if (activateOutcome.kind !== 'accepted') {
      return this.fail(token, base, childSessionId, 'activate', activateOutcome.kind, activateOutcome.code, activateOutcome.summary)
    }

    // ── hydrate（可选） ─────────────────────────────────────────────────────
    if (this.host.hydrate !== undefined) {
      if (!this.publish(token, { ...base, phase: 'hydrating', childSessionId, failureStage: null, outcome: null, reasonCode: null, safeSummary: null })) {
        return this.store.getSnapshot()
      }
      const hydrateOutcome = await this.callHost(
        this.host.hydrate({ operationId: request.operationId, childSessionId }),
      )
      if (hydrateOutcome.kind !== 'accepted') {
        return this.fail(token, base, childSessionId, 'hydrate', hydrateOutcome.kind, hydrateOutcome.code, hydrateOutcome.summary)
      }
    }

    // ── succeeded ───────────────────────────────────────────────────────────
    this.publish(token, { ...base, phase: 'succeeded', childSessionId, failureStage: null, outcome: null, reasonCode: null, safeSummary: null })
    return this.store.getSnapshot()
  }

  /**
   * 未分类 throw 一律 unknown（adapter 负责把 owner typed rejection 映射为
   * rejected；这里只兜底，绝不把异常升级成 rejected）。
   */
  private async callHost<T>(call: Promise<RewriteMutationOutcomeV2<T>>): Promise<RewriteMutationOutcomeV2<T>> {
    try {
      return await call
    } catch (error) {
      const code = typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : 'host_error'
      return unknownOutcome<T>(code)
    }
  }

  /** 收敛 recoverable_error：child 已知时始终保留，由调用方决定显式恢复动作。 */
  private fail(
    token: number,
    base: OperationBase,
    childSessionId: string | null,
    stage: RewriteFailureStageV2,
    outcome: 'rejected' | 'unknown',
    code: string,
    summary: string | undefined,
  ): RewriteOperationStateV2 {
    const next: RewriteOperationStateV2 = {
      ...base,
      phase: 'recoverable_error',
      childSessionId,
      failureStage: stage,
      outcome,
      reasonCode: code,
      safeSummary: normalizeRewriteSafeSummary(summary) ?? null,
    }
    this.publish(token, next)
    return this.store.getSnapshot()
  }
}

/** outcome helpers 通过 index 再导出，便于 consumer 单入口使用。 */
export { accepted, rejected, unknownOutcome }
