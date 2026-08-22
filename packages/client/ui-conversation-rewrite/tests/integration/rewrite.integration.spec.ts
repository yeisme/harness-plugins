import { describe, expect, it, vi } from 'vitest'
import { ChatRewriteController, type ChatRewriteHost } from '../../src/client/controller.ts'
import type { RewriteTarget } from '../../src/client/boundary.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

const SESSION = 's1' as SessionId
const CHILD = 'child-1' as SessionId

function makeHost(): ChatRewriteHost & { calls: string[]; fork: ReturnType<typeof vi.fn>; prompt: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn>; forkBeforeMessage?: ReturnType<typeof vi.fn> } {
  const calls: string[] = []
  const fork = vi.fn(async (opts: { sessionId: SessionId; atSeq: number; increaseTitle?: boolean }) => {
    calls.push(`fork:${opts.atSeq}`)
    return CHILD
  })
  const prompt = vi.fn(async (_sessionId: SessionId, text: string) => {
    calls.push(`prompt:${text}`)
    return { accepted: true }
  })
  const open = vi.fn((_sessionId: SessionId) => {
    calls.push('open')
  })
  return { fork, prompt, open, calls }
}

describe('conversation rewrite integration', () => {
  it('retry derives a child at the previous turn boundary, prompts the original text, and opens it', async () => {
    const host = makeHost()
    const controller = new ChatRewriteController(host)
    const target: RewriteTarget = { kind: 'retry', key: 'retry:a2', seq: 7, boundarySeq: 5, text: 'second' }
    await controller.run(SESSION, target)
    expect(host.calls).toEqual(['fork:5', 'prompt:second', 'open'])
    expect(host.prompt).toHaveBeenCalledWith(CHILD, 'second')
    expect(host.open).toHaveBeenCalledWith(CHILD)
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'opened' })
  })

  it('edit derives a child and prompts the edited text', async () => {
    const host = makeHost()
    const controller = new ChatRewriteController(host)
    const target: RewriteTarget = { kind: 'edit', key: 'edit:6', seq: 6, boundarySeq: 5, text: 'edited' }
    await controller.run(SESSION, target)
    expect(host.calls).toEqual(['fork:5', 'prompt:edited', 'open'])
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'opened' })
  })

  it('uses forkBeforeMessage for first-round rewrite when the seam is available', async () => {
    const host = makeHost()
    const forkBeforeMessage = vi.fn(async () => CHILD)
    host.forkBeforeMessage = forkBeforeMessage
    const controller = new ChatRewriteController(host)
    const target: RewriteTarget = { kind: 'edit', key: 'edit:0', seq: 0, boundarySeq: null, text: 'first edited' }
    await controller.run(SESSION, target)
    expect(forkBeforeMessage).toHaveBeenCalledWith({ sessionId: SESSION, atMessageSeq: 0 })
    expect(host.fork).not.toHaveBeenCalled()
    expect(host.calls).toEqual(['prompt:first edited', 'open'])
  })

  it('keeps the parent session untouched and reports a typed error when the child prompt fails', async () => {
    const host = makeHost()
    host.prompt.mockRejectedValue({ code: 'BUSY', message: 'child busy' })
    const controller = new ChatRewriteController(host)
    const target: RewriteTarget = { kind: 'retry', key: 'retry:a2', seq: 7, boundarySeq: 5, text: 'second' }
    await controller.run(SESSION, target)
    expect(host.open).not.toHaveBeenCalled()
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'error', errorCode: 'BUSY' })
  })
})
