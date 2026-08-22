import { describe, expect, it } from 'vitest'
import type { ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import { computeEditTarget, computeRetryTarget, previousTurnEndSeq, textOfContent } from '../../src/client/boundary.ts'

const SESSION = 's1' as SessionId

function textUser(seq: number, text: string): ConversationSnapshot['nodes'][number] {
  return { kind: 'user', seq, time: seq * 1000, content: [{ type: 'text', text }], source: undefined }
}

function imageUser(seq: number): ConversationSnapshot['nodes'][number] {
  return {
    kind: 'user',
    seq,
    time: seq * 1000,
    content: [
      { type: 'text', text: 'look at' },
      { type: 'image', attachment: { ref: 'img-1', mediaType: 'image/png', width: 1, height: 1 } as never },
    ],
    source: undefined,
  }
}

function assistant(seq: number, turn: number, messageId: string): ConversationSnapshot['nodes'][number] {
  return { kind: 'assistant', seq, time: seq * 1000, turn, step: 0, blocks: [{ kind: 'text', text: 'ok' }], messageId: messageId as MessageId }
}

function snapshotWith(nodes: ConversationSnapshot['nodes'], turnEnds: ReadonlyMap<number, number>, running = false, removed = false): ConversationSnapshot {
  return {
    sessionId: SESSION,
    views: {} as never,
    chat: {} as never,
    nodes,
    turnTimings: new Map(),
    turnEnds,
    partial: null,
    runningCalls: [],
    pending: [],
    queue: [],
    running,
    subagent: null,
    composerPhase: 'active',
    removed,
    openState: 'open',
    openError: null,
    hasMore: false,
    loadingOlder: false,
    promptError: null,
    blank: false,
    lastAgentError: null,
  }
}

describe('textOfContent', () => {
  it('joins text blocks', () => {
    const node = textUser(1, 'hello')
    expect(textOfContent(node.content)).toBe('hello')
  })

  it('rejects non-text blocks', () => {
    expect(textOfContent(imageUser(1).content)).toBeNull()
  })

  it('rejects empty text', () => {
    expect(textOfContent(textUser(1, '').content)).toBeNull()
  })
})

describe('previousTurnEndSeq', () => {
  it('returns the closest completed turn/end before a seq', () => {
    const snapshot = snapshotWith([], new Map([[1, 5], [2, 9]]))
    expect(previousTurnEndSeq(snapshot, 6)).toBe(5)
    expect(previousTurnEndSeq(snapshot, 10)).toBe(9)
  })

  it('returns null before the first turn/end', () => {
    const snapshot = snapshotWith([], new Map([[1, 5]]))
    expect(previousTurnEndSeq(snapshot, 3)).toBeNull()
  })
})

describe('computeRetryTarget', () => {
  it('locates the prompt and forks before its turn boundary for non-first rounds', () => {
    const snapshot = snapshotWith(
      [textUser(0, 'first'), assistant(1, 1, 'a1'), textUser(6, 'second'), assistant(7, 2, 'a2')],
      new Map([[1, 5], [2, 8]]),
    )
    const decision = computeRetryTarget(snapshot, 'a2' as MessageId)
    expect(decision).toMatchObject({ ok: true, target: { kind: 'retry', seq: 7, boundarySeq: 5, text: 'second' } })
  })

  it('disables first-round retry', () => {
    const snapshot = snapshotWith(
      [textUser(0, 'first'), assistant(1, 1, 'a1')],
      new Map([[1, 2]]),
    )
    expect(computeRetryTarget(snapshot, 'a1' as MessageId)).toEqual({ ok: false, reason: 'first-round' })
  })

  it('enables first-round retry when forkBeforeMessage is available', () => {
    const snapshot = snapshotWith(
      [textUser(0, 'first'), assistant(1, 1, 'a1')],
      new Map([[1, 2]]),
    )
    expect(computeRetryTarget(snapshot, 'a1' as MessageId, { firstRound: true })).toMatchObject({
      ok: true,
      target: { kind: 'retry', seq: 1, boundarySeq: null, text: 'first' },
    })
  })

  it('disables a running turn', () => {
    const snapshot = snapshotWith(
      [textUser(6, 'second'), assistant(7, 2, 'a2')],
      new Map([[1, 5]]),
      true,
    )
    expect(computeRetryTarget(snapshot, 'a2' as MessageId)).toEqual({ ok: false, reason: 'running' })
  })

  it('disables unknown message ids', () => {
    const snapshot = snapshotWith([], new Map())
    expect(computeRetryTarget(snapshot, 'missing' as MessageId)).toEqual({ ok: false, reason: 'not-found' })
  })

  it('disables non-text prompts', () => {
    const snapshot = snapshotWith(
      [imageUser(6), assistant(7, 2, 'a2')],
      new Map([[1, 5], [2, 8]]),
    )
    expect(computeRetryTarget(snapshot, 'a2' as MessageId)).toEqual({ ok: false, reason: 'not-text' })
  })

  it('disables removed sessions', () => {
    const snapshot = snapshotWith([], new Map(), false, true)
    expect(computeRetryTarget(snapshot, 'a2' as MessageId)).toEqual({ ok: false, reason: 'removed' })
  })
})

describe('computeEditTarget', () => {
  it('uses the previous turn boundary for non-first user messages', () => {
    const snapshot = snapshotWith(
      [textUser(0, 'first'), assistant(1, 1, 'a1'), textUser(6, 'second'), assistant(7, 2, 'a2')],
      new Map([[1, 5], [2, 8]]),
    )
    const decision = computeEditTarget(snapshot, 6)
    expect(decision).toMatchObject({ ok: true, target: { kind: 'edit', seq: 6, boundarySeq: 5, text: 'second' } })
  })

  it('disables first-round editing', () => {
    const snapshot = snapshotWith(
      [textUser(0, 'first'), assistant(1, 1, 'a1')],
      new Map([[1, 2]]),
    )
    expect(computeEditTarget(snapshot, 0)).toEqual({ ok: false, reason: 'first-round' })
  })

  it('enables first-round editing when forkBeforeMessage is available', () => {
    const snapshot = snapshotWith(
      [textUser(0, 'first'), assistant(1, 1, 'a1')],
      new Map([[1, 2]]),
    )
    expect(computeEditTarget(snapshot, 0, { firstRound: true })).toMatchObject({
      ok: true,
      target: { kind: 'edit', seq: 0, boundarySeq: null, text: 'first' },
    })
  })

  it('disables running-turn editing', () => {
    const snapshot = snapshotWith(
      [textUser(6, 'second')],
      new Map([[1, 5]]),
      true,
    )
    expect(computeEditTarget(snapshot, 6)).toEqual({ ok: false, reason: 'running' })
  })

  it('rejects non-user nodes', () => {
    const snapshot = snapshotWith([assistant(1, 1, 'a1')], new Map([[1, 2]]))
    expect(computeEditTarget(snapshot, 1)).toEqual({ ok: false, reason: 'not-found' })
  })

  it('rejects non-text user messages', () => {
    const snapshot = snapshotWith([imageUser(6), assistant(7, 2, 'a2')], new Map([[1, 5], [2, 8]]))
    expect(computeEditTarget(snapshot, 6)).toEqual({ ok: false, reason: 'not-text' })
  })
})
