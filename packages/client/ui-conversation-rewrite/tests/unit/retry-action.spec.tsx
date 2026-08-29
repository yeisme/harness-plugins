// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ConversationSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import { ChatRewriteController } from '../../src/client/controller.ts'
import { makeRetryAction } from '../../src/client/retry.tsx'
import { en } from '../../src/client/locales.ts'

afterEach(cleanup)

const SESSION = 's1' as SessionId

function snapshot(): ConversationSnapshot {
  return {
    sessionId: SESSION,
    views: {} as never,
    chat: {} as never,
    nodes: [
      { kind: 'user', seq: 0, time: 0, content: [{ type: 'text', text: 'first' }], source: undefined },
      { kind: 'assistant', seq: 1, time: 1, turn: 1, step: 0, blocks: [{ kind: 'text', text: 'ok' }], messageId: 'a1' as MessageId },
      { kind: 'user', seq: 6, time: 6, content: [{ type: 'text', text: 'second' }], source: undefined },
      { kind: 'assistant', seq: 7, time: 7, turn: 2, step: 0, blocks: [{ kind: 'text', text: 'ok' }], messageId: 'a2' as MessageId },
    ],
    turnTimings: new Map(),
    turnEnds: new Map([[1, 5], [2, 8]]),
    partial: null,
    runningCalls: [],
    pending: [],
    queue: [],
    running: false,
    subagent: null,
    composerPhase: 'active',
    removed: false,
    openState: 'open',
    openError: null,
    hasMore: false,
    loadingOlder: false,
    promptError: null,
    blank: false,
    lastAgentError: null,
  }
}

describe('RetryAction store subscription', () => {
  it('renders without crashing when React extracts store.getSnapshot', () => {
    const host = { fork: vi.fn(), prompt: vi.fn(), open: vi.fn() }
    const controller = new ChatRewriteController(host)
    const getSnapshot = controller.store.getSnapshot
    expect(getSnapshot().phase).toBe('idle')
    const RetryAction = makeRetryAction(controller)
    render(
      <RetryAction
        messageId={'a2' as MessageId}
        sessionId={SESSION}
        useSession={selector => selector(snapshot())}
        t={key => en[key]}
      />,
    )
    const button = screen.getByRole('button', { name: 'Retry' })
    expect(button.querySelector('svg')).not.toBeNull()
    expect(button.textContent).toBe('')
  })

  it('does not render a dead replacement when the retry boundary is unavailable', () => {
    const host = { fork: vi.fn(), prompt: vi.fn(), open: vi.fn() }
    const controller = new ChatRewriteController(host)
    const RetryAction = makeRetryAction(controller)
    const firstRound = snapshot()
    firstRound.nodes = firstRound.nodes.slice(0, 2)
    firstRound.turnEnds = new Map([[1, 2]])
    render(
      <RetryAction
        messageId={'a1' as MessageId}
        sessionId={SESSION}
        useSession={selector => selector(firstRound)}
        t={key => en[key]}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })
})
