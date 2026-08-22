import { describe, expect, it, vi } from 'vitest'
import { apply, bindForkBeforeMessage, hasUserActionsSlot } from '../../src/client/index.ts'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

function slotCtx(names: readonly string[]): {
  ctx: ClientContext
  injected: string[]
} {
  const injected: string[] = []
  const specs = new Map(names.map(name => [name, { kind: 'list' }]))
  const ctx = {
    slots: {
      spec: (name: string) => specs.get(name),
      inject: (name: string, factory: () => unknown) => {
        injected.push(name)
        factory()
        return () => {}
      },
      register: (descriptor: { name: string }) => descriptor,
    },
    locale: { register: () => () => {} },
    sessions: {
      fork: vi.fn(),
      binding: () => undefined,
      open: vi.fn(),
    },
    effect: (register: () => () => void) => {
      register()
      return () => {}
    },
  } as unknown as ClientContext
  return { ctx, injected }
}

describe('hasUserActionsSlot', () => {
  it('is false when the conversation surface never published the slot', () => {
    expect(hasUserActionsSlot(undefined)).toBe(false)
    expect(hasUserActionsSlot({ spec: () => undefined })).toBe(false)
  })

  it('is true when the upstream slot spec is present', () => {
    expect(hasUserActionsSlot({ spec: (name) => name === 'conversation.chat.user-actions' ? { kind: 'list' } : undefined })).toBe(true)
  })
})

describe('bindForkBeforeMessage', () => {
  it('returns undefined on published sessions hosts', () => {
    expect(bindForkBeforeMessage({ fork: () => {} })).toBeUndefined()
    expect(bindForkBeforeMessage(undefined)).toBeUndefined()
  })

  it('binds a live forkBeforeMessage implementation', async () => {
    const child = 'child-1' as SessionId
    const forkBeforeMessage = vi.fn().mockResolvedValue(child)
    const bound = bindForkBeforeMessage({ forkBeforeMessage })
    expect(bound).toBeTypeOf('function')
    await expect(bound?.({ sessionId: 's1' as SessionId, atMessageSeq: 0 })).resolves.toBe(child)
    expect(forkBeforeMessage).toHaveBeenCalledWith({ sessionId: 's1', atMessageSeq: 0 })
  })
})

describe('apply Edit registration', () => {
  it('registers Retry only when the user-actions slot is absent', async () => {
    const { ctx, injected } = slotCtx(['conversation.chat.assistant-actions'])
    await apply(ctx)
    expect(injected).toEqual(['conversation.chat.assistant-actions'])
  })

  it('registers Edit when the upstream user-actions slot exists', async () => {
    const { ctx, injected } = slotCtx([
      'conversation.chat.assistant-actions',
      'conversation.chat.user-actions',
    ])
    await apply(ctx)
    expect(injected).toEqual([
      'conversation.chat.assistant-actions',
      'conversation.chat.user-actions',
    ])
  })
})
