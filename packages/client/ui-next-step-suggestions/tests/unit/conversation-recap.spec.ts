import { describe, expect, it } from 'vitest'
import { completionSuggestions, conversationRecapFromSnapshot } from '../../src/client/conversation-recap.ts'

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    openState: 'open',
    removed: false,
    running: false,
    pending: [],
    partial: null,
    turnEnds: new Map([[2, 9]]),
    nodes: [{
      kind: 'assistant',
      seq: 8,
      turn: 2,
      step: 1,
      blocks: [
        { kind: 'reasoning', text: 'PRIVATE_REASONING_SENTINEL' },
        { kind: 'text', text: `  Finished   the requested work. ${'x'.repeat(220)} ` },
        { kind: 'tool-call', callId: 'call-1', name: 'read', argsRaw: 'PRIVATE_TOOL_SENTINEL' },
      ],
    }],
    ...overrides,
  } as never
}

describe('conversation completion fallback', () => {
  it('degrades to null on the 0.1.2 session-shell snapshot without conversation fields', () => {
    expect(conversationRecapFromSnapshot({ openState: 'open' } as never)).toBeNull()
    expect(conversationRecapFromSnapshot({ openState: 'open', nodes: [] } as never)).toBeNull()
    expect(conversationRecapFromSnapshot(null as never)).toBeNull()
  })

  it('builds a bounded recap from finalized text only', () => {
    const recap = conversationRecapFromSnapshot(snapshot())
    expect(recap).toMatchObject({ id: 'turn:2:9', turn: 2 })
    expect([...(recap?.summary ?? '')]).toHaveLength(180)
    expect(recap?.summary).not.toContain('PRIVATE_REASONING_SENTINEL')
    expect(recap?.summary).not.toContain('PRIVATE_TOOL_SENTINEL')
  })

  it('fails closed while active or after a failed latest turn', () => {
    expect(conversationRecapFromSnapshot(snapshot({ running: true }))).toBeNull()
    expect(conversationRecapFromSnapshot(snapshot({ pending: [{}] }))).toBeNull()
    expect(conversationRecapFromSnapshot(snapshot({
      nodes: [{ kind: 'turn-error', turn: 2, seq: 9, step: 1, time: 0, message: 'failed' }],
    }))).toBeNull()
  })

  it('creates exactly three stable draft suggestions', () => {
    const recap = conversationRecapFromSnapshot(snapshot())!
    const suggestions = completionSuggestions(recap, {
      reviewLabel: 'Review',
      reviewPrompt: 'Review prompt',
      verifyLabel: 'Verify',
      verifyPrompt: 'Verify prompt',
      continueLabel: 'Continue',
      continuePrompt: 'Continue prompt',
    })
    expect(suggestions).toHaveLength(3)
    expect(suggestions.map(item => item.prompt)).toEqual(['Review prompt', 'Verify prompt', 'Continue prompt'])
    expect(suggestions[0]).toMatchObject({ recommended: true, source: 'host' })
  })
})
