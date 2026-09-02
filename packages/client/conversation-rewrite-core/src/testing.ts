/**
 * Shared host-neutral contract fixtures。
 *
 * Web 与 TUI 的 consumer 测试执行同一份 case 表，证明 boundary 决策与
 * staged mutation 分类跨 surface 一致；expected 表只在本包定义一次，
 * consumer 不复制。所有文本/ID 均为虚构，不含真实 prompt、绝对路径或
 * provider payload。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite-core/testing
 */

import {
  ConversationRewriteControllerV2,
  type RewriteForkValueV2,
  type RewriteMutationHostV2,
  type RewriteOperationStateV2,
  type RewriteUnitValueV2,
} from './controller.ts'
import { accepted, type RewriteMutationOutcomeV2 } from './outcome.ts'
import { computeRetryTargetV2, computeUserTurnTargetV2 } from './boundary.ts'
import type {
  RewriteCapabilitiesV2,
  RewriteConversationSnapshotV2,
  RewriteDecisionV2,
  RewriteKindV2,
  RewriteMessageV2,
  RewriteTargetV2,
} from './types.ts'

// ─── fixture 类型 ────────────────────────────────────────────────────────────

/** boundary 决策 case：输入 snapshot + 请求，期望 decision。 */
export interface RewriteBoundaryFixtureV2 {
  readonly type: 'boundary'
  readonly id: string
  readonly snapshot: RewriteConversationSnapshotV2
  readonly capabilities: RewriteCapabilitiesV2
  readonly request:
    | { readonly type: 'user-turn'; readonly userSeq: number; readonly kind: RewriteKindV2 }
    | { readonly type: 'retry'; readonly assistantKey: string }
  readonly expected: RewriteDecisionV2
}

/** 脚本化 host 的一步：按调用顺序消费。 */
export type RewriteHostScriptStepV2 =
  | { readonly call: 'fork' | 'forkBeforeMessage'; readonly outcome: RewriteMutationOutcomeV2<RewriteForkValueV2> }
  | { readonly call: 'prompt' | 'activate' | 'hydrate'; readonly outcome: RewriteMutationOutcomeV2<RewriteUnitValueV2> }

/** mutation case：脚本 host 顺序释放，期望最终 state（部分匹配）。 */
export interface RewriteMutationFixtureV2 {
  readonly type: 'mutation'
  readonly id: string
  readonly target: RewriteTargetV2
  readonly script: readonly RewriteHostScriptStepV2[]
  readonly expected: Readonly<Partial<RewriteOperationStateV2>>
}

/** procedure case：覆盖 duplicate run 与 dispose-late-result 时序。 */
export interface RewriteProcedureFixtureV2 {
  readonly type: 'procedure'
  readonly id: string
  readonly target: RewriteTargetV2
  /** 每步一个 deferred owner 调用，按 actions 中的 `settle` 顺序释放。 */
  readonly steps: ReadonlyArray<{
    readonly call: 'fork' | 'prompt' | 'activate'
    readonly settleWith: RewriteMutationOutcomeV2<RewriteForkValueV2 | RewriteUnitValueV2>
  }>
  readonly actions: ReadonlyArray<'run' | 'run-duplicate' | 'dispose' | 'settle'>
  readonly expected: Readonly<Partial<RewriteOperationStateV2>>
}

export type RewriteContractCaseV2 = RewriteBoundaryFixtureV2 | RewriteMutationFixtureV2 | RewriteProcedureFixtureV2

// ─── 构造 helper（fixture 与 consumer 复用） ─────────────────────────────────

export function fixtureMessage(
  key: string,
  kind: 'user' | 'steering' | 'assistant',
  seq: number,
  text: string | null,
  completed = true,
): RewriteMessageV2 {
  const content = text === null
    ? [{ type: 'image', src: `fake://${key}` }]
    : [{ type: 'text', text }]
  return { key, kind, seq, content, completed }
}

export function fixtureSnapshot(overrides: Partial<RewriteConversationSnapshotV2> = {}): RewriteConversationSnapshotV2 {
  return {
    sessionId: 'sess-fixture',
    generation: 3,
    running: false,
    removed: false,
    messages: [],
    turnEnds: [],
    ...overrides,
  }
}

export function fixtureTarget(overrides: Partial<RewriteTargetV2> = {}): RewriteTargetV2 {
  return {
    kind: 'edit',
    key: 'edit:u2',
    sourceSessionId: 'sess-fixture',
    sourceGeneration: 3,
    messageKey: 'u2',
    messageSeq: 4,
    boundarySeq: 3,
    text: 'SECOND_ORIGINAL_PROMPT',
    ...overrides,
  }
}

// ─── case 表 ────────────────────────────────────────────────────────────────

const CAPS_OFF: RewriteCapabilitiesV2 = { forkBeforeMessage: false }
const CAPS_ON: RewriteCapabilitiesV2 = { forkBeforeMessage: true }

/** 两轮完整对话的标准 snapshot：u1→a1(end3)→u2→a2(end7)。 */
const TWO_TURN_SNAPSHOT = fixtureSnapshot({
  messages: [
    fixtureMessage('u1', 'user', 1, 'FIRST_ORIGINAL_PROMPT'),
    fixtureMessage('a1', 'assistant', 2, 'FIRST_ANSWER'),
    fixtureMessage('u2', 'user', 4, 'SECOND_ORIGINAL_PROMPT'),
    fixtureMessage('a2', 'assistant', 5, 'SECOND_ANSWER'),
  ],
  turnEnds: [3, 7],
})

/** 只有第一轮、尚无 turn/end 的 snapshot。 */
const FIRST_TURN_ONLY = fixtureSnapshot({
  messages: [
    fixtureMessage('u1', 'user', 1, 'FIRST_ORIGINAL_PROMPT'),
    fixtureMessage('a1', 'assistant', 2, 'FIRST_ANSWER'),
  ],
  turnEnds: [],
})

export const rewriteContractCasesV2: readonly RewriteContractCaseV2[] = [
  // boundary：completed edit / retry
  {
    type: 'boundary',
    id: 'boundary-edit-completed',
    snapshot: TWO_TURN_SNAPSHOT,
    capabilities: CAPS_OFF,
    request: { type: 'user-turn', userSeq: 4, kind: 'edit' },
    expected: { ok: true, target: fixtureTarget() },
  },
  {
    type: 'boundary',
    id: 'boundary-retry-completed',
    snapshot: TWO_TURN_SNAPSHOT,
    capabilities: CAPS_OFF,
    request: { type: 'retry', assistantKey: 'a2' },
    expected: { ok: true, target: fixtureTarget({ kind: 'retry', key: 'retry:a2' }) },
  },
  // boundary：首轮路径与"不 fallback 到更晚 prompt"
  {
    type: 'boundary',
    id: 'boundary-edit-first-prompt-first-round',
    snapshot: TWO_TURN_SNAPSHOT,
    capabilities: CAPS_OFF,
    request: { type: 'user-turn', userSeq: 1, kind: 'edit' },
    // u1 之前没有 turn/end：首轮路径。
    expected: { ok: false, reason: 'first-round' },
  },
  {
    type: 'boundary',
    id: 'boundary-retry-uses-own-prompt',
    snapshot: TWO_TURN_SNAPSHOT,
    capabilities: CAPS_OFF,
    request: { type: 'retry', assistantKey: 'a1' },
    // a1 对应 u1：同样走首轮路径，绝不 fallback 到更晚的 u2。
    expected: { ok: false, reason: 'first-round' },
  },
  // boundary：first-round enabled / disabled
  {
    type: 'boundary',
    id: 'boundary-first-round-enabled',
    snapshot: FIRST_TURN_ONLY,
    capabilities: CAPS_ON,
    request: { type: 'user-turn', userSeq: 1, kind: 'edit' },
    expected: {
      ok: true,
      target: fixtureTarget({
        key: 'edit:u1',
        messageKey: 'u1',
        messageSeq: 1,
        boundarySeq: null,
        text: 'FIRST_ORIGINAL_PROMPT',
      }),
    },
  },
  {
    type: 'boundary',
    id: 'boundary-first-round-disabled',
    snapshot: FIRST_TURN_ONLY,
    capabilities: CAPS_OFF,
    request: { type: 'user-turn', userSeq: 1, kind: 'edit' },
    expected: { ok: false, reason: 'first-round' },
  },
  // boundary：running / settlement
  {
    type: 'boundary',
    id: 'boundary-user-turn-running',
    snapshot: fixtureSnapshot({
      running: true,
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST_ORIGINAL_PROMPT'),
        fixtureMessage('a1', 'assistant', 2, 'FIRST_ANSWER'),
        fixtureMessage('u2', 'user', 4, 'SECOND_ORIGINAL_PROMPT'),
      ],
      turnEnds: [3],
    }),
    capabilities: CAPS_ON,
    request: { type: 'user-turn', userSeq: 4, kind: 'edit' },
    expected: { ok: false, reason: 'running' },
  },
  {
    type: 'boundary',
    id: 'boundary-retry-settlement-pending',
    snapshot: fixtureSnapshot({
      running: true,
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST_ORIGINAL_PROMPT'),
        fixtureMessage('a1', 'assistant', 2, 'FIRST_ANSWER'),
        fixtureMessage('u2', 'user', 4, 'SECOND_ORIGINAL_PROMPT'),
        fixtureMessage('a2', 'assistant', 5, 'SECOND_ANSWER_PARTIAL'),
      ],
      turnEnds: [3],
    }),
    capabilities: CAPS_OFF,
    request: { type: 'retry', assistantKey: 'a2' },
    expected: { ok: false, reason: 'settlement-pending' },
  },
  {
    type: 'boundary',
    id: 'boundary-message-not-settled',
    snapshot: fixtureSnapshot({
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST_ORIGINAL_PROMPT'),
        fixtureMessage('a1', 'assistant', 2, 'FIRST_ANSWER'),
        fixtureMessage('u2', 'user', 4, 'SECOND_ORIGINAL_PROMPT', false),
      ],
      turnEnds: [3],
    }),
    capabilities: CAPS_ON,
    request: { type: 'user-turn', userSeq: 4, kind: 'edit' },
    expected: { ok: false, reason: 'settlement-pending' },
  },
  // boundary：non-text / removed / not-found
  {
    type: 'boundary',
    id: 'boundary-non-text-prompt',
    snapshot: fixtureSnapshot({
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST_ORIGINAL_PROMPT'),
        fixtureMessage('a1', 'assistant', 2, 'FIRST_ANSWER'),
        fixtureMessage('u2', 'user', 4, null),
        fixtureMessage('a2', 'assistant', 5, 'SECOND_ANSWER'),
      ],
      turnEnds: [3, 7],
    }),
    capabilities: CAPS_ON,
    request: { type: 'user-turn', userSeq: 4, kind: 'edit' },
    expected: { ok: false, reason: 'not-text' },
  },
  {
    type: 'boundary',
    id: 'boundary-removed-session',
    snapshot: fixtureSnapshot({ removed: true, messages: TWO_TURN_SNAPSHOT.messages, turnEnds: [3, 7] }),
    capabilities: CAPS_ON,
    request: { type: 'user-turn', userSeq: 4, kind: 'edit' },
    expected: { ok: false, reason: 'removed' },
  },
  {
    type: 'boundary',
    id: 'boundary-user-seq-not-found',
    snapshot: TWO_TURN_SNAPSHOT,
    capabilities: CAPS_ON,
    request: { type: 'user-turn', userSeq: 99, kind: 'edit' },
    expected: { ok: false, reason: 'not-found' },
  },
  {
    type: 'boundary',
    id: 'boundary-assistant-key-not-found',
    snapshot: TWO_TURN_SNAPSHOT,
    capabilities: CAPS_ON,
    request: { type: 'retry', assistantKey: 'missing' },
    expected: { ok: false, reason: 'not-found' },
  },
  // boundary：非首条 prompt 缺稳定边界（同轮排队 prompt）
  {
    type: 'boundary',
    id: 'boundary-stable-boundary-unavailable',
    snapshot: fixtureSnapshot({
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST_ORIGINAL_PROMPT'),
        fixtureMessage('s1', 'steering', 2, 'STEER_BEFORE_ANY_END'),
      ],
      turnEnds: [],
    }),
    capabilities: CAPS_ON,
    request: { type: 'user-turn', userSeq: 2, kind: 'edit' },
    expected: { ok: false, reason: 'stable-boundary-unavailable' },
  },

  // mutation：全阶段成功（含 hydrate）
  {
    type: 'mutation',
    id: 'mutation-full-success',
    target: fixtureTarget(),
    script: [
      { call: 'fork', outcome: accepted({ childSessionId: 'child-1' }) },
      { call: 'prompt', outcome: accepted({}) },
      { call: 'activate', outcome: accepted({}) },
      { call: 'hydrate', outcome: accepted({}) },
    ],
    expected: { phase: 'succeeded', childSessionId: 'child-1', failureStage: null, outcome: null },
  },
  // mutation：fork rejected → 无 child
  {
    type: 'mutation',
    id: 'mutation-fork-rejected',
    target: fixtureTarget(),
    script: [{ call: 'fork', outcome: { kind: 'rejected', code: 'owner_denied' } }],
    expected: { phase: 'recoverable_error', failureStage: 'fork', outcome: 'rejected', childSessionId: null, reasonCode: 'owner_denied' },
  },
  // mutation：fork unknown + partial child → 保留 child ID
  {
    type: 'mutation',
    id: 'mutation-fork-unknown-partial-child',
    target: fixtureTarget(),
    script: [{ call: 'fork', outcome: { kind: 'unknown', code: 'transport_disconnect', partial: { childSessionId: 'child-9' } } }],
    expected: { phase: 'recoverable_error', failureStage: 'fork', outcome: 'unknown', childSessionId: 'child-9' },
  },
  // mutation：prompt rejected（child 已知 → 保留）
  {
    type: 'mutation',
    id: 'mutation-prompt-rejected',
    target: fixtureTarget(),
    script: [
      { call: 'fork', outcome: accepted({ childSessionId: 'child-2' }) },
      { call: 'prompt', outcome: { kind: 'rejected', code: 'prompt_denied' } },
    ],
    expected: { phase: 'recoverable_error', failureStage: 'prompt', outcome: 'rejected', childSessionId: 'child-2' },
  },
  // mutation：prompt unknown（child 已知 → 保留，不自动重发）
  {
    type: 'mutation',
    id: 'mutation-prompt-unknown',
    target: fixtureTarget(),
    script: [
      { call: 'fork', outcome: accepted({ childSessionId: 'child-3' }) },
      { call: 'prompt', outcome: { kind: 'unknown', code: 'timeout' } },
    ],
    expected: { phase: 'recoverable_error', failureStage: 'prompt', outcome: 'unknown', childSessionId: 'child-3' },
  },
  // mutation：activate / hydrate 失败（child 已知 → 保留）
  {
    type: 'mutation',
    id: 'mutation-activate-rejected',
    target: fixtureTarget(),
    script: [
      { call: 'fork', outcome: accepted({ childSessionId: 'child-4' }) },
      { call: 'prompt', outcome: accepted({}) },
      { call: 'activate', outcome: { kind: 'rejected', code: 'activate_denied' } },
    ],
    expected: { phase: 'recoverable_error', failureStage: 'activate', outcome: 'rejected', childSessionId: 'child-4' },
  },
  {
    type: 'mutation',
    id: 'mutation-hydrate-unknown',
    target: fixtureTarget(),
    script: [
      { call: 'fork', outcome: accepted({ childSessionId: 'child-5' }) },
      { call: 'prompt', outcome: accepted({}) },
      { call: 'activate', outcome: accepted({}) },
      { call: 'hydrate', outcome: { kind: 'unknown', code: 'timeout' } },
    ],
    expected: { phase: 'recoverable_error', failureStage: 'hydrate', outcome: 'unknown', childSessionId: 'child-5' },
  },
  // mutation：首轮 forkBeforeMessage 成功路径
  {
    type: 'mutation',
    id: 'mutation-fork-before-message-success',
    target: fixtureTarget({ key: 'edit:u1', messageKey: 'u1', messageSeq: 1, boundarySeq: null, text: 'FIRST_EDITED_PROMPT' }),
    script: [
      { call: 'forkBeforeMessage', outcome: accepted({ childSessionId: 'child-6' }) },
      { call: 'prompt', outcome: accepted({}) },
      { call: 'activate', outcome: accepted({}) },
    ],
    expected: { phase: 'succeeded', childSessionId: 'child-6' },
  },
  // mutation：boundarySeq=null 且能力缺席 → fail closed，零 owner 调用
  {
    type: 'mutation',
    id: 'mutation-first-round-capability-missing',
    target: fixtureTarget({ boundarySeq: null }),
    script: [],
    expected: { phase: 'recoverable_error', failureStage: 'fork', outcome: 'rejected', reasonCode: 'fork_before_message_unavailable' },
  },

  // procedure：duplicate run（并发第二个 run 汇合同一 operation）
  {
    type: 'procedure',
    id: 'procedure-duplicate-run',
    target: fixtureTarget(),
    steps: [
      { call: 'fork', settleWith: accepted({ childSessionId: 'child-7' }) },
      { call: 'prompt', settleWith: accepted({}) },
      { call: 'activate', settleWith: accepted({}) },
    ],
    actions: ['run', 'run-duplicate', 'settle', 'settle', 'settle'],
    expected: { phase: 'succeeded', childSessionId: 'child-7' },
  },
  // procedure：dispose 后迟到结果不得发布成功
  {
    type: 'procedure',
    id: 'procedure-dispose-late-result',
    target: fixtureTarget(),
    steps: [
      { call: 'fork', settleWith: accepted({ childSessionId: 'child-8' }) },
      { call: 'prompt', settleWith: accepted({}) },
      { call: 'activate', settleWith: accepted({}) },
    ],
    actions: ['run', 'dispose', 'settle', 'settle', 'settle'],
    expected: { phase: 'recoverable_error', outcome: 'stale', reasonCode: 'disposed' },
  },
]

// ─── consumer 侧执行器 ──────────────────────────────────────────────────────

/** 按脚本顺序消费的 host：意外调用直接 reject，帮助 consumer 定位错位。 */
export interface ScriptedRewriteHostV2 extends RewriteMutationHostV2 {
  /** 已发生的调用序列（只有方法名，不含参数文本）。 */
  readonly calls: readonly string[]
}

export function createScriptedRewriteHostV2(script: readonly RewriteHostScriptStepV2[]): ScriptedRewriteHostV2 {
  const calls: string[] = []
  let cursor = 0
  function consume(call: string): Promise<RewriteMutationOutcomeV2<RewriteForkValueV2 | RewriteUnitValueV2>> {
    calls.push(call)
    const step = script[cursor]
    cursor += 1
    if (step === undefined || step.call !== call) {
      return Promise.reject(new Error(`unexpected host call: ${call} at #${calls.length} (script: ${step?.call ?? 'exhausted'})`))
    }
    return Promise.resolve(step.outcome)
  }
  const host: ScriptedRewriteHostV2 = {
    fork: () => consume('fork') as Promise<RewriteMutationOutcomeV2<RewriteForkValueV2>>,
    prompt: () => consume('prompt') as Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>,
    activate: () => consume('activate') as Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>,
    calls,
    // exactOptionalPropertyTypes：可选方法用条件展开，避免显式 undefined
    ...(hasStep('forkBeforeMessage') ? { forkBeforeMessage: () => consume('forkBeforeMessage') as Promise<RewriteMutationOutcomeV2<RewriteForkValueV2>> } : {}),
    ...(hasStep('hydrate') ? { hydrate: () => consume('hydrate') as Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>> } : {}),
  }
  return host

  function hasStep(call: string): boolean {
    return script.some((step) => step.call === call)
  }
}

/** procedure case 用的手动释放 host。 */
interface DeferredRewriteHost {
  readonly host: RewriteMutationHostV2
  readonly calls: readonly string[]
  settle(index: number, outcome: RewriteMutationOutcomeV2<RewriteForkValueV2 | RewriteUnitValueV2>): void
}

function createDeferredHost(): DeferredRewriteHost {
  const resolvers: Array<(outcome: RewriteMutationOutcomeV2<RewriteForkValueV2 | RewriteUnitValueV2>) => void> = []
  const calls: string[] = []
  function recordCall(call: 'fork' | 'prompt' | 'activate'): Promise<RewriteMutationOutcomeV2<RewriteForkValueV2 | RewriteUnitValueV2>> {
    calls.push(call)
    return new Promise((resolve) => {
      resolvers.push(resolve)
    })
  }
  return {
    host: {
      fork: () => recordCall('fork') as Promise<RewriteMutationOutcomeV2<RewriteForkValueV2>>,
      prompt: () => recordCall('prompt') as Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>,
      activate: () => recordCall('activate') as Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>,
    },
    calls,
    settle(index, outcome) {
      const resolve = resolvers[index]
      if (resolve !== undefined) resolve(outcome)
    },
  }
}

/** 单个 contract case 的执行结果。 */
export interface RewriteContractResultV2 {
  readonly id: string
  readonly final: RewriteOperationStateV2 | null
  readonly decision: RewriteDecisionV2 | null
  /** mutation/procedure case 的 host 调用顺序（只有方法名）。 */
  readonly calls: readonly string[]
}

/**
 * 执行单个 contract case：boundary → decision；mutation/procedure → 走
 * V2 controller 得到最终 state。consumer 对照 expected 做部分匹配断言。
 */
export async function executeRewriteContractCaseV2(kase: RewriteContractCaseV2): Promise<RewriteContractResultV2> {
  if (kase.type === 'boundary') {
    const decision =
      kase.request.type === 'user-turn'
        ? computeUserTurnTargetV2(kase.snapshot, kase.request.userSeq, kase.request.kind, kase.capabilities)
        : computeRetryTargetV2(kase.snapshot, kase.request.assistantKey, kase.capabilities)
    return { id: kase.id, final: null, decision, calls: [] }
  }
  if (kase.type === 'mutation') {
    const host = createScriptedRewriteHostV2(kase.script)
    const controller = new ConversationRewriteControllerV2(host)
    const final = await controller.run({ operationId: `op:${kase.id}`, target: kase.target })
    return { id: kase.id, final, decision: null, calls: host.calls }
  }
  const deferred = createDeferredHost()
  const controller = new ConversationRewriteControllerV2(deferred.host)
  const runs: Array<Promise<RewriteOperationStateV2>> = []
  let settleIndex = 0
  for (const action of kase.actions) {
    if (action === 'run') {
      runs.push(controller.run({ operationId: `op:${kase.id}`, target: kase.target }))
    } else if (action === 'run-duplicate') {
      runs.push(controller.run({ operationId: 'op:duplicate', target: kase.target }))
    } else if (action === 'dispose') {
      controller.dispose()
    } else {
      deferred.settle(settleIndex, kase.steps[settleIndex]?.settleWith ?? accepted({}))
      settleIndex += 1
      // 等一个 macrotask，让 controller 完成当前 stage 的 microtask 链并
      // 注册下一个挂起调用，避免连续 settle 落空。
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    }
  }
  await Promise.all(runs)
  return { id: kase.id, final: controller.store.getSnapshot(), decision: null, calls: deferred.calls }
}

/** decision 深比较（target 按 JSON 全等）。 */
export function matchesRewriteDecisionV2(actual: RewriteDecisionV2, expected: RewriteDecisionV2): boolean {
  return JSON.stringify(sortKeys(actual)) === JSON.stringify(sortKeys(expected))
}

/** state 部分匹配：expected 中出现的字段必须全等。 */
export function matchesRewriteStateV2(actual: RewriteOperationStateV2, expected: Readonly<Partial<RewriteOperationStateV2>>): boolean {
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(actual[key as keyof RewriteOperationStateV2]) !== JSON.stringify(value)) return false
  }
  return true
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (typeof value === 'object' && value !== null) {
    const record: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      record[key] = sortKeys((value as Record<string, unknown>)[key])
    }
    return record
  }
  return value
}
