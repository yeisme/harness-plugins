import { describe, expect, it, vi } from 'vitest'
import { ChatRewriteController, type ChatRewriteHost } from '../../src/client/controller.ts'
import type { RewriteTarget } from '../../src/client/boundary.ts'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

const SESSION = 's1' as SessionId
const CHILD = 'child-1' as SessionId

function target(overrides: Partial<RewriteTarget> = {}): RewriteTarget {
  return { kind: 'retry', key: 'retry:a1', seq: 7, boundarySeq: 5, text: 'second', ...overrides }
}

function fakeHost(overrides: Partial<ChatRewriteHost> = {}): ChatRewriteHost & { fork: ReturnType<typeof vi.fn>; prompt: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> } {
  const fork = vi.fn().mockResolvedValue(CHILD)
  const prompt = vi.fn().mockResolvedValue({ accepted: true })
  const open = vi.fn()
  return { fork, prompt, open, ...overrides } as ChatRewriteHost & { fork: typeof fork; prompt: typeof prompt; open: typeof open }
}

describe('ChatRewriteController', () => {
  it('runs fork + prompt + open and publishes opened', async () => {
    const host = fakeHost()
    const controller = new ChatRewriteController(host)
    await controller.run(SESSION, target())
    expect(host.fork).toHaveBeenCalledWith({ sessionId: SESSION, atSeq: 5, increaseTitle: true })
    expect(host.prompt).toHaveBeenCalledWith(CHILD, 'second')
    expect(host.open).toHaveBeenCalledWith(CHILD)
    expect(controller.store.getSnapshot()).toEqual({ phase: 'opened', activeKey: 'retry:a1', errorCode: null, errorMessage: null })
  })

  it('single-flights concurrent submissions', async () => {
    const host = fakeHost()
    let resolvePrompt: ((value: unknown) => void) | undefined
    host.prompt.mockImplementation(() => new Promise((resolve) => { resolvePrompt = resolve }))
    const controller = new ChatRewriteController(host)
    const first = controller.run(SESSION, target())
    const second = controller.run(SESSION, target())
    expect(first).toBe(second)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(resolvePrompt).toBeDefined()
    resolvePrompt?.({ accepted: true })
    await first
    expect(host.fork).toHaveBeenCalledTimes(1)
    expect(host.prompt).toHaveBeenCalledTimes(1)
  })

  it('publishes a typed error when prompt fails', async () => {
    const host = fakeHost()
    host.prompt.mockRejectedValue({ code: 'PROMPT_REJECTED', message: 'prompt rejected' })
    const controller = new ChatRewriteController(host)
    await controller.run(SESSION, target())
    expect(host.open).not.toHaveBeenCalled()
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'error', activeKey: 'retry:a1', errorCode: 'PROMPT_REJECTED', errorMessage: 'prompt rejected' })
  })

  it('prefers forkBeforeMessage for first-round targets', async () => {
    const forkBeforeMessage = vi.fn().mockResolvedValue(CHILD)
    const host = fakeHost({ forkBeforeMessage })
    const controller = new ChatRewriteController(host)
    await controller.run(SESSION, target({ boundarySeq: null }))
    expect(forkBeforeMessage).toHaveBeenCalledWith({ sessionId: SESSION, atMessageSeq: 7 })
    expect(host.fork).not.toHaveBeenCalled()
    expect(controller.store.getSnapshot().phase).toBe('opened')
  })

  it('fails closed when first-round target has no forkBeforeMessage seam', async () => {
    const controller = new ChatRewriteController(fakeHost())
    await controller.run(SESSION, target({ boundarySeq: null }))
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'error', errorCode: 'mutation_failed' })
  })

  it('dispose settles a pending mutation as an error', async () => {
    const host = fakeHost()
    let resolvePrompt: ((value: unknown) => void) | undefined
    host.prompt.mockImplementation(() => new Promise((resolve) => { resolvePrompt = resolve }))
    const controller = new ChatRewriteController(host)
    const run = controller.run(SESSION, target())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(resolvePrompt).toBeDefined()
    controller.dispose()
    expect(controller.store.getSnapshot()).toMatchObject({ phase: 'error', errorCode: 'disposed' })
    resolvePrompt?.({ accepted: true })
    await run
    expect(controller.store.getSnapshot().phase).toBe('error')
  })

  it('reset returns to idle', async () => {
    const host = fakeHost()
    host.prompt.mockRejectedValue({ code: 'FAIL', message: 'nope' })
    const controller = new ChatRewriteController(host)
    await controller.run(SESSION, target())
    controller.reset()
    expect(controller.store.getSnapshot()).toEqual({ phase: 'idle', activeKey: null, errorCode: null, errorMessage: null })
  })
})
