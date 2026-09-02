import { describe, expect, it } from 'vitest'
import {
  ConversationRewriteControllerV2,
  type RewriteMutationHostV2,
  type RewriteOperationStateV2,
} from '../src/controller.ts'
import { accepted, normalizeRewriteSafeSummary, rejected, unknownOutcome, type RewriteMutationOutcomeV2 } from '../src/outcome.ts'
import { fixtureTarget } from '../src/testing.ts'
import type { RewriteForkValueV2, RewriteUnitValueV2 } from '../src/controller.ts'
import type { RewriteTargetV2 } from '../src/types.ts'

type AnyOutcome = RewriteMutationOutcomeV2<RewriteForkValueV2 | RewriteUnitValueV2>

/** 等一个 macrotask：让 controller 的 microtask 链推进并注册下一个挂起调用。 */
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

interface DeferredHost {
  readonly host: RewriteMutationHostV2
  readonly calls: string[]
  /** 手动释放当前挂起调用（按调用顺序）。 */
  settle(outcome: AnyOutcome): void
}

/** 每个调用都挂起直到手动释放的 host，用于 single-flight/dispose 时序测试。 */
function deferredHost(): DeferredHost {
  const calls: string[] = []
  const pending: Array<(outcome: AnyOutcome) => void> = []
  function hang(call: string): Promise<AnyOutcome> {
    calls.push(call)
    return new Promise((resolve) => {
      pending.push(resolve)
    })
  }
  return {
    host: {
      fork: () => hang('fork') as Promise<RewriteMutationOutcomeV2<RewriteForkValueV2>>,
      forkBeforeMessage: () => hang('forkBeforeMessage') as Promise<RewriteMutationOutcomeV2<RewriteForkValueV2>>,
      prompt: () => hang('prompt') as Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>,
      activate: () => hang('activate') as Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>,
      hydrate: () => hang('hydrate') as Promise<RewriteMutationOutcomeV2<RewriteUnitValueV2>>,
    },
    calls,
    settle(outcome) {
      const resolve = pending.shift()
      resolve?.(outcome)
    },
  }
}

function statesFrom(controller: ConversationRewriteControllerV2): RewriteOperationStateV2[] {
  const seen: RewriteOperationStateV2[] = [controller.store.getSnapshot()]
  controller.store.subscribe(() => {
    seen.push(controller.store.getSnapshot())
  })
  return seen
}

const TARGET: RewriteTargetV2 = fixtureTarget()
const FORK_OK = accepted({ childSessionId: 'child-d' })
const UNIT_OK = accepted({} as Record<string, never>)

describe('ConversationRewriteControllerV2', () => {
  it('成功路径按序执行 fork→prompt→activate→hydrate 并收敛 succeeded', async () => {
    const script: Array<Record<string, unknown>> = []
    const host: RewriteMutationHostV2 = {
      fork: async (input) => {
        script.push({ call: 'fork', boundarySeq: input.boundarySeq, operationId: input.operationId })
        return accepted({ childSessionId: 'child-1' })
      },
      prompt: async (input) => {
        script.push({ call: 'prompt', hasText: input.text.length > 0, child: input.childSessionId })
        return accepted({})
      },
      activate: async (input) => {
        script.push({ call: 'activate', id: input.childSessionId })
        return accepted({})
      },
      hydrate: async (input) => {
        script.push({ call: 'hydrate', id: input.childSessionId })
        return accepted({})
      },
    }
    const controller = new ConversationRewriteControllerV2(host)
    const seen = statesFrom(controller)
    const final = await controller.run({ operationId: 'op-1', target: TARGET })
    expect(final.phase).toBe('succeeded')
    expect(final.childSessionId).toBe('child-1')
    expect(final.failureStage).toBeNull()
    expect(final.operationId).toBe('op-1')
    expect(final.targetKey).toBe(TARGET.key)
    expect(script.map((entry) => entry.call)).toEqual(['fork', 'prompt', 'activate', 'hydrate'])
    expect(seen.map((state) => state.phase)).toEqual(['idle', 'forking', 'prompting', 'activating', 'hydrating', 'succeeded'])
  })

  it('hydrate 缺席时 pipeline 跳过 hydrate', async () => {
    const calls: string[] = []
    const host: RewriteMutationHostV2 = {
      fork: async () => {
        calls.push('fork')
        return accepted({ childSessionId: 'c' })
      },
      prompt: async () => {
        calls.push('prompt')
        return accepted({})
      },
      activate: async () => {
        calls.push('activate')
        return accepted({})
      },
    }
    const controller = new ConversationRewriteControllerV2(host)
    const final = await controller.run({ operationId: 'op-2', target: TARGET })
    expect(final.phase).toBe('succeeded')
    expect(calls).toEqual(['fork', 'prompt', 'activate'])
  })

  it('boundarySeq=null：forkBeforeMessage 携带 messageSeq；能力缺席 fail closed 零调用', async () => {
    let calls = 0
    const host: RewriteMutationHostV2 = {
      fork: async () => {
        calls += 1
        return accepted({ childSessionId: 'c' })
      },
      prompt: async () => {
        calls += 1
        return accepted({})
      },
      activate: async () => {
        calls += 1
        return accepted({})
      },
    }
    const first: RewriteTargetV2 = { ...TARGET, boundarySeq: null, messageSeq: 1 }
    const controller = new ConversationRewriteControllerV2(host)
    const final = await controller.run({ operationId: 'op-3', target: first })
    expect(final.phase).toBe('recoverable_error')
    expect(final.failureStage).toBe('fork')
    expect(final.reasonCode).toBe('fork_before_message_unavailable')
    expect(calls).toBe(0)

    const seenSeqs: number[] = []
    const withCapability: RewriteMutationHostV2 = {
      ...host,
      forkBeforeMessage: async (input) => {
        calls += 1
        seenSeqs.push(input.messageSeq)
        return accepted({ childSessionId: 'child-fbm' })
      },
    }
    const controller2 = new ConversationRewriteControllerV2(withCapability)
    const final2 = await controller2.run({ operationId: 'op-4', target: first })
    expect(final2.phase).toBe('succeeded')
    expect(final2.childSessionId).toBe('child-fbm')
    expect(seenSeqs).toEqual([1])
    expect(calls).toBe(3)
  })

  it('single-flight：活跃期间第二个 run 汇合同一 Promise，不重复 fork', async () => {
    const deferred = deferredHost()
    const controller = new ConversationRewriteControllerV2(deferred.host)
    const first = controller.run({ operationId: 'op-a', target: TARGET })
    const second = controller.run({ operationId: 'op-b', target: TARGET })
    deferred.settle(FORK_OK)
    await flush()
    deferred.settle(UNIT_OK)
    await flush()
    deferred.settle(UNIT_OK)
    await flush()
    deferred.settle(UNIT_OK)
    const [finalFirst, finalSecond] = await Promise.all([first, second])
    expect(deferred.calls).toEqual(['fork', 'prompt', 'activate', 'hydrate'])
    expect(finalFirst.phase).toBe('succeeded')
    expect(finalSecond).toBe(finalFirst)
  })

  it('reset 回到 idle，之后的 run 正常开始', async () => {
    const host: RewriteMutationHostV2 = {
      fork: async () => accepted({ childSessionId: 'c1' }),
      prompt: async () => accepted({}),
      activate: async () => accepted({}),
    }
    const controller = new ConversationRewriteControllerV2(host)
    await controller.run({ operationId: 'op-5', target: TARGET })
    controller.reset()
    expect(controller.store.getSnapshot().phase).toBe('idle')
    const again = await controller.run({ operationId: 'op-6', target: TARGET })
    expect(again.phase).toBe('succeeded')
    expect(again.operationId).toBe('op-6')
  })

  it('dispose：活跃中收敛 recoverable_error(stale/disposed)；迟到成功不得发布', async () => {
    const deferred = deferredHost()
    const controller = new ConversationRewriteControllerV2(deferred.host)
    const seen = statesFrom(controller)
    const run = controller.run({ operationId: 'op-7', target: TARGET })
    controller.dispose()
    expect(controller.store.getSnapshot()).toMatchObject({
      phase: 'recoverable_error',
      outcome: 'stale',
      reasonCode: 'disposed',
      failureStage: 'fork',
    })
    deferred.settle(FORK_OK)
    deferred.settle(UNIT_OK)
    deferred.settle(UNIT_OK)
    await run
    expect(seen.map((state) => state.phase)).not.toContain('succeeded')
    expect(controller.store.getSnapshot().phase).toBe('recoverable_error')
    // dispose 后的 run 立即返回当前 state，不启动新 operation
    const after = await controller.run({ operationId: 'op-8', target: TARGET })
    expect(after.phase).toBe('recoverable_error')
    expect(deferred.calls).toEqual(['fork'])
  })

  it('partial success 矩阵：各阶段 rejected/unknown 的 child 保留与收敛', async () => {
    const cases: Array<{
      id: string
      script: Array<'accepted' | 'rejected' | 'unknown'>
      expected: Pick<RewriteOperationStateV2, 'phase' | 'failureStage' | 'outcome' | 'childSessionId' | 'reasonCode'>
    }> = [
      { id: 'fork-rejected', script: ['rejected'], expected: { phase: 'recoverable_error', failureStage: 'fork', outcome: 'rejected', childSessionId: null, reasonCode: 'owner_denied' } },
      { id: 'fork-unknown-no-partial', script: ['unknown'], expected: { phase: 'recoverable_error', failureStage: 'fork', outcome: 'unknown', childSessionId: null, reasonCode: 'transport_disconnect' } },
      { id: 'prompt-rejected', script: ['accepted', 'rejected'], expected: { phase: 'recoverable_error', failureStage: 'prompt', outcome: 'rejected', childSessionId: 'child-x', reasonCode: 'prompt_denied' } },
      { id: 'prompt-unknown', script: ['accepted', 'unknown'], expected: { phase: 'recoverable_error', failureStage: 'prompt', outcome: 'unknown', childSessionId: 'child-x', reasonCode: 'timeout' } },
      { id: 'activate-rejected', script: ['accepted', 'accepted', 'rejected'], expected: { phase: 'recoverable_error', failureStage: 'activate', outcome: 'rejected', childSessionId: 'child-x', reasonCode: 'activate_denied' } },
      { id: 'hydrate-unknown', script: ['accepted', 'accepted', 'accepted', 'unknown'], expected: { phase: 'recoverable_error', failureStage: 'hydrate', outcome: 'unknown', childSessionId: 'child-x', reasonCode: 'timeout' } },
    ]
    for (const kase of cases) {
      let index = 0
      const step = (stage: number): AnyOutcome => {
        const outcome = kase.script[index]
        index += 1
        if (stage === 0) {
          if (outcome === 'accepted') return accepted({ childSessionId: 'child-x' })
          if (outcome === 'rejected') return rejected('owner_denied')
          return unknownOutcome('transport_disconnect')
        }
        if (outcome === 'accepted') return accepted({} as Record<string, never>)
        if (outcome === 'rejected') return rejected(stage === 1 ? 'prompt_denied' : 'activate_denied')
        return unknownOutcome('timeout')
      }
      const host: RewriteMutationHostV2 = {
        fork: async () => step(0) as RewriteMutationOutcomeV2<RewriteForkValueV2>,
        prompt: async () => step(1) as RewriteMutationOutcomeV2<RewriteUnitValueV2>,
        activate: async () => step(2) as RewriteMutationOutcomeV2<RewriteUnitValueV2>,
        hydrate: async () => step(3) as RewriteMutationOutcomeV2<RewriteUnitValueV2>,
      }
      const controller = new ConversationRewriteControllerV2(host)
      const final = await controller.run({ operationId: `op-${kase.id}`, target: TARGET })
      expect(final, kase.id).toMatchObject(kase.expected)
    }
  })

  it('fork unknown 的 partial childSessionId 保留在 state 中', async () => {
    const host: RewriteMutationHostV2 = {
      fork: async () => unknownOutcome('disconnect_after_write', { childSessionId: 'child-partial' }),
      prompt: async () => accepted({}),
      activate: async () => accepted({}),
    }
    const controller = new ConversationRewriteControllerV2(host)
    const final = await controller.run({ operationId: 'op-9', target: TARGET })
    expect(final).toMatchObject({ phase: 'recoverable_error', failureStage: 'fork', childSessionId: 'child-partial', outcome: 'unknown' })
  })

  it('sentinel：序列化全部状态/receipt 不含 prompt 文本', async () => {
    const host: RewriteMutationHostV2 = {
      fork: async () => accepted({ childSessionId: 'child-s' }),
      prompt: async () => rejected('prompt_denied'),
      activate: async () => accepted({}),
    }
    const controller = new ConversationRewriteControllerV2(host)
    await controller.run({ operationId: 'op-10', target: { ...TARGET, text: 'SECRET_ORIGINAL_PROMPT_TEXT' } })
    const serialized = JSON.stringify(controller.store.getSnapshot())
    expect(serialized).not.toContain('SECRET_ORIGINAL_PROMPT_TEXT')
    expect(serialized).not.toContain('ORIGINAL_PROMPT')
  })

  it('未分类 host throw 一律 unknown，绝不升级为 rejected', async () => {
    const host: RewriteMutationHostV2 = {
      fork: async () => {
        throw new Error('boom')
      },
      prompt: async () => accepted({}),
      activate: async () => accepted({}),
    }
    const controller = new ConversationRewriteControllerV2(host)
    const final = await controller.run({ operationId: 'op-11', target: TARGET })
    expect(final).toMatchObject({ phase: 'recoverable_error', failureStage: 'fork', outcome: 'unknown', reasonCode: 'host_error' })
  })
})

describe('outcome helpers', () => {
  it('summary 规范化：单行、去控制字符、256 上限', () => {
    const long = `line1\n${'x'.repeat(300)}\ttail`
    const normalized = normalizeRewriteSafeSummary(long)
    expect(normalized).toBeDefined()
    expect(normalized).not.toContain('\n')
    expect(normalized).not.toContain('\t')
    expect(normalized!.length).toBeLessThanOrEqual(256)
    expect(normalizeRewriteSafeSummary('   ')).toBeUndefined()
    expect(normalizeRewriteSafeSummary(undefined)).toBeUndefined()
    const rejectedOutcome = rejected('code', 'ok summary')
    expect(rejectedOutcome.summary).toBe('ok summary')
  })
})
