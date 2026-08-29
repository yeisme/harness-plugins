import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/client/apply.ts'
import { clearSeededMedia } from '../src/client/preview-seed.ts'

afterEach(() => {
  clearSeededMedia()
})

describe('rich-media client apply', () => {
  it('declares slots so Cordis does not throw on ctx.slots', () => {
    const source = readFileSync(fileURLToPath(new URL('../src/client/index.ts', import.meta.url)), 'utf8')
    expect(source).toContain("export const inject = ['slots', 'conversationEvents'] as const")
  })

  it('fails closed when slots or conversationEvents are absent', async () => {
    const missing = await apply({} as never)
    expect(typeof missing).toBe('function')
    missing()
  })

  it('registers the media node when both seams exist', async () => {
    const registerEvent = vi.fn(() => vi.fn())
    const registerSlot = vi.fn(() => vi.fn())
    const injectSlot = vi.fn((_name: string, setup: () => unknown) => {
      setup()
      return vi.fn()
    })
    const dispose = await apply({
      conversationEvents: { register: registerEvent },
      slots: { inject: injectSlot, register: registerSlot },
    } as never)
    expect(registerEvent).toHaveBeenCalledTimes(1)
    expect(injectSlot).toHaveBeenCalledWith('conversation.chat.node', expect.any(Function))
    expect(registerSlot).toHaveBeenCalledWith(expect.objectContaining({
      name: 'conversation.chat.node',
      key: 'media-ref',
    }), expect.anything())
    dispose()
  })

  it('binds an overlay opener when paneWorkbench exists', async () => {
    const registerEvent = vi.fn(() => vi.fn())
    const registerSlot = vi.fn(() => vi.fn())
    const injectSlot = vi.fn((_name: string, setup: () => unknown) => {
      setup()
      return vi.fn()
    })
    const openView = vi.fn()
    await apply({
      conversationEvents: { register: registerEvent },
      slots: { inject: injectSlot, register: registerSlot },
      paneWorkbench: { openView },
    } as never)
    const view = registerSlot.mock.calls[0]?.[1] as (props: { node: { data: { removed?: boolean; title: string; media: Record<string, unknown> } } }) => { props: { onOpenInPane?: (media: Record<string, unknown>) => void } }
    const media = {
      owner: 'dsh',
      kind: 'image',
      ref: 'img-1',
      version: 'v1',
      mediaType: 'image/png',
      title: 'Example image',
      capabilities: ['preview'],
    }
    const element = view({ node: { data: { title: 'Example image', media } } })
    element.props.onOpenInPane?.(media)
    expect(openView).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'desktop.media',
      resourceKey: 'img-1',
    }))
  })
})
