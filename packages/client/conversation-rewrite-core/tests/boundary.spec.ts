import { describe, expect, it } from 'vitest'
import {
  computeRetryTargetV2,
  computeUserTurnTargetV2,
  previousTurnEndSeqV2,
  textOfRewriteContentV2,
} from '../src/boundary.ts'
import { fixtureMessage, fixtureSnapshot } from '../src/testing.ts'

const CAPS_OFF = { forkBeforeMessage: false } as const
const CAPS_ON = { forkBeforeMessage: true } as const

/** 标准两轮 snapshot：u1(1)→a1(2)→end3→u2(4)→a2(5)→end7。 */
function twoTurns() {
  return fixtureSnapshot({
    messages: [
      fixtureMessage('u1', 'user', 1, 'FIRST'),
      fixtureMessage('a1', 'assistant', 2, 'A1'),
      fixtureMessage('u2', 'user', 4, 'SECOND'),
      fixtureMessage('a2', 'assistant', 5, 'A2'),
    ],
    turnEnds: [3, 7],
  })
}

describe('computeUserTurnTargetV2', () => {
  it('非首轮 completed text-only prompt 返回最近前置边界', () => {
    const decision = computeUserTurnTargetV2(twoTurns(), 4, 'edit', CAPS_OFF)
    expect(decision).toEqual({
      ok: true,
      target: {
        kind: 'edit',
        key: 'edit:u2',
        sourceSessionId: 'sess-fixture',
        sourceGeneration: 3,
        messageKey: 'u2',
        messageSeq: 4,
        boundarySeq: 3,
        text: 'SECOND',
      },
    })
  })

  it('steering prompt 同样可作为目标', () => {
    const snapshot = fixtureSnapshot({
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST'),
        fixtureMessage('a1', 'assistant', 2, 'A1'),
        fixtureMessage('s1', 'steering', 5, 'STEER'),
        fixtureMessage('a2', 'assistant', 6, 'A2'),
      ],
      turnEnds: [3, 8],
    })
    const decision = computeUserTurnTargetV2(snapshot, 5, 'edit', CAPS_OFF)
    expect(decision.ok).toBe(true)
    if (decision.ok) expect(decision.target.boundarySeq).toBe(3)
  })

  it('removed → removed；未知 seq → not-found；非文本 → not-text', () => {
    const snapshot = twoTurns()
    expect(computeUserTurnTargetV2({ ...snapshot, removed: true }, 4, 'edit', CAPS_ON)).toEqual({ ok: false, reason: 'removed' })
    expect(computeUserTurnTargetV2(snapshot, 99, 'edit', CAPS_ON)).toEqual({ ok: false, reason: 'not-found' })
    // assistant seq 不是 prompt 目标
    expect(computeUserTurnTargetV2(snapshot, 5, 'edit', CAPS_ON)).toEqual({ ok: false, reason: 'not-found' })
    const nonText = fixtureSnapshot({
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST'),
        fixtureMessage('a1', 'assistant', 2, 'A1'),
        fixtureMessage('u2', 'user', 4, null),
      ],
      turnEnds: [3],
    })
    expect(computeUserTurnTargetV2(nonText, 4, 'edit', CAPS_ON)).toEqual({ ok: false, reason: 'not-text' })
  })

  it('首轮：能力可用时返回 boundarySeq=null 可执行目标，缺席时 first-round', () => {
    const firstOnly = fixtureSnapshot({
      messages: [fixtureMessage('u1', 'user', 1, 'FIRST')],
      turnEnds: [],
    })
    expect(computeUserTurnTargetV2(firstOnly, 1, 'edit', CAPS_OFF)).toEqual({ ok: false, reason: 'first-round' })
    const enabled = computeUserTurnTargetV2(firstOnly, 1, 'retry', CAPS_ON)
    expect(enabled).toEqual({
      ok: true,
      target: {
        kind: 'retry',
        key: 'retry:u1',
        sourceSessionId: 'sess-fixture',
        sourceGeneration: 3,
        messageKey: 'u1',
        messageSeq: 1,
        boundarySeq: null,
        text: 'FIRST',
      },
    })
  })

  it('非首条 prompt 缺边界 → stable-boundary-unavailable（同轮排队）', () => {
    const queued = fixtureSnapshot({
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST'),
        fixtureMessage('s1', 'steering', 2, 'STEER'),
      ],
      turnEnds: [],
    })
    expect(computeUserTurnTargetV2(queued, 2, 'edit', CAPS_ON)).toEqual({ ok: false, reason: 'stable-boundary-unavailable' })
  })

  it('running：目标 turn 未结束时 user 目标 → running；completed=false → settlement-pending', () => {
    const running = fixtureSnapshot({
      running: true,
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST'),
        fixtureMessage('a1', 'assistant', 2, 'A1'),
        fixtureMessage('u2', 'user', 4, 'SECOND'),
      ],
      turnEnds: [3],
    })
    expect(computeUserTurnTargetV2(running, 4, 'edit', CAPS_ON)).toEqual({ ok: false, reason: 'running' })
    // running 但目标是已结束 turn 的 prompt：走首轮路径（u1 无前置 end），
    // 能力缺席时保持 first-round，不受 running 影响（与 Web V1 顺序一致）。
    expect(computeUserTurnTargetV2(running, 1, 'edit', CAPS_OFF)).toEqual({ ok: false, reason: 'first-round' })

    const unsettled = fixtureSnapshot({
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST'),
        fixtureMessage('a1', 'assistant', 2, 'A1'),
        fixtureMessage('u2', 'user', 4, 'SECOND', false),
      ],
      turnEnds: [3],
    })
    expect(computeUserTurnTargetV2(unsettled, 4, 'edit', CAPS_ON)).toEqual({ ok: false, reason: 'settlement-pending' })
  })

  it('pure：重复调用结果一致，输入 snapshot 不被修改（乱序消息也不受影响）', () => {
    const snapshot = fixtureSnapshot({
      messages: [
        fixtureMessage('a2', 'assistant', 5, 'A2'),
        fixtureMessage('u1', 'user', 1, 'FIRST'),
        fixtureMessage('a1', 'assistant', 2, 'A1'),
        fixtureMessage('u2', 'user', 4, 'SECOND'),
      ],
      turnEnds: [7, 3],
    })
    const before = JSON.stringify(snapshot)
    const first = computeUserTurnTargetV2(snapshot, 4, 'edit', CAPS_OFF)
    const second = computeUserTurnTargetV2(snapshot, 4, 'edit', CAPS_OFF)
    expect(first).toEqual(second)
    expect(JSON.stringify(snapshot)).toBe(before)
    if (first.ok) expect(first.target.boundarySeq).toBe(3)
  })
})

describe('computeRetryTargetV2', () => {
  it('按 assistant key 解析其 prompt 与边界，绝不 fallback 到更晚 prompt', () => {
    const snapshot = twoTurns()
    const decision = computeRetryTargetV2(snapshot, 'a2', CAPS_OFF)
    expect(decision).toEqual({
      ok: true,
      target: {
        kind: 'retry',
        key: 'retry:a2',
        sourceSessionId: 'sess-fixture',
        sourceGeneration: 3,
        messageKey: 'u2',
        messageSeq: 4,
        boundarySeq: 3,
        text: 'SECOND',
      },
    })
    // a1 对应 u1（首轮路径），不会借用 u2
    expect(computeRetryTargetV2(snapshot, 'a1', CAPS_OFF)).toEqual({ ok: false, reason: 'first-round' })
    expect(computeRetryTargetV2(snapshot, 'missing', CAPS_ON)).toEqual({ ok: false, reason: 'not-found' })
  })

  it('running 的最后一轮 → settlement-pending；prompt 非文本 → not-text', () => {
    const running = fixtureSnapshot({
      running: true,
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST'),
        fixtureMessage('a1', 'assistant', 2, 'A1'),
        fixtureMessage('u2', 'user', 4, 'SECOND'),
        fixtureMessage('a2', 'assistant', 5, 'A2_PARTIAL'),
      ],
      turnEnds: [3],
    })
    expect(computeRetryTargetV2(running, 'a2', CAPS_ON)).toEqual({ ok: false, reason: 'settlement-pending' })

    const nonText = fixtureSnapshot({
      messages: [
        fixtureMessage('u1', 'user', 1, 'FIRST'),
        fixtureMessage('a1', 'assistant', 2, 'A1'),
        fixtureMessage('u2', 'user', 4, null),
        fixtureMessage('a2', 'assistant', 5, 'A2'),
      ],
      turnEnds: [3, 7],
    })
    expect(computeRetryTargetV2(nonText, 'a2', CAPS_ON)).toEqual({ ok: false, reason: 'not-text' })
  })
})

describe('helpers', () => {
  it('previousTurnEndSeqV2 返回严格小于 beforeSeq 的最大值', () => {
    expect(previousTurnEndSeqV2([7, 3, 11], 6)).toBe(3)
    expect(previousTurnEndSeqV2([7, 3, 11], 3)).toBe(null)
    expect(previousTurnEndSeqV2([], 10)).toBe(null)
  })

  it('textOfRewriteContentV2：全 text 拼接；空/非 text/坏 text 返回 null', () => {
    expect(textOfRewriteContentV2([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }])).toBe('ab')
    expect(textOfRewriteContentV2([{ type: 'text', text: '' }])).toBe(null)
    expect(textOfRewriteContentV2([{ type: 'image', src: 'x' }])).toBe(null)
    expect(textOfRewriteContentV2([{ type: 'text', text: 'a' }, { type: 'text', text: 1 as unknown as string }])).toBe(null)
  })
})
