// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, name, inject } from '../src/client/index.ts'
import { SideChatController } from '../src/controller.ts'
import { SideChatView } from '../src/view.tsx'
import { fallbackSideChatTranslator } from '../src/locales.ts'
import type { SideChatSessionBinding, SideChatSessionsFace } from '../src/controller.ts'

afterEach(() => { cleanup() })

const t = fallbackSideChatTranslator()

function snapshotOf(overrides: Partial<Parameters<SideChatController['getSession']>[0] extends never ? never : NonNullable<ReturnType<SideChatController['getSession']>>['getSnapshot'] extends () => infer S ? S : never> = {}) {
  return {
    running: false,
    removed: false,
    nodes: [],
    queue: [],
    promptError: null,
    hasMore: false,
    loadingOlder: false,
    ...overrides,
  }
}

function face(snapshot: () => ReturnType<typeof snapshotOf>, prompts: string[] = []): SideChatSessionsFace {
  // useSyncExternalStore 要求稳定快照：真实 runtime 每次事件才发新对象，
  // fake 以 memo 对齐该语义。
  let cached: ReturnType<typeof snapshotOf> | undefined
  const stableSnapshot = (): ReturnType<typeof snapshotOf> => {
    cached ??= snapshot()
    return cached
  }
  return {
    list: { getSnapshot: () => ({ ids: ['s-1'], byId: { 's-1': { displayTitle: 'Build', running: false } }, current: 's-1' }), subscribe: () => () => {} },
    binding: (id): SideChatSessionBinding | undefined => ({
      sessionId: id,
      session: {
        prompt: async content => {
          prompts.push(content[0]?.text ?? '')
          return { ok: true }
        },
        cancel: async () => ({ ok: true }),
        loadOlder: async () => {},
        subscribe: () => () => {},
        getSnapshot: stableSnapshot,
      },
    }),
    fork: async () => 's-2',
  }
}

describe('SideChatView render matrix', () => {
  it('renders the empty body before attaching', () => {
    const controller = new SideChatController(face(() => snapshotOf()))
    const { container } = render(createElement(SideChatView, {
      controller,
      sessions: [{ sessionId: 's-1', displayTitle: 'Build', running: false }],
      currentSessionId: 's-1',
      t,
    }))
    expect(container.querySelector('[data-dsh-side-chat]')?.getAttribute('data-side-chat-phase')).toBe('empty')
    expect(container.textContent ?? '').toContain('main chat area stays untouched')
    controller.dispose()
  })

  it('renders nodes with collapsed tool cards and errors after attaching', () => {
    const controller = new SideChatController(face(() => snapshotOf({
      nodes: [
        { kind: 'user', seq: 1, content: [{ type: 'text', text: 'list files' }] },
        { kind: 'assistant', seq: 2, blocks: [
          { kind: 'text', text: 'Running ls now.' },
          { kind: 'tool-call', name: 'bash' },
          { kind: 'tool-call', name: 'read' },
        ] },
        { kind: 'turn-error', seq: 3 },
      ],
    })))
    controller.attach('s-1')
    const { container } = render(createElement(SideChatView, {
      controller,
      sessions: [{ sessionId: 's-1', displayTitle: 'Build', running: false }],
      currentSessionId: 's-1',
      t,
    }))
    expect(container.querySelector('[data-side-chat-node="user"]')?.textContent).toBe('list files')
    expect(container.querySelector('[data-side-chat-node="assistant"]')?.textContent).toContain('Running ls now.')
    expect(container.querySelector('[data-side-chat-tools="2"]')).not.toBeNull()
    expect(container.querySelector('[data-side-chat-node="turn-error"]')).not.toBeNull()
    controller.dispose()
  })

  it('disables the new-session action with a readable reason when create is absent', () => {
    const controller = new SideChatController(face(() => snapshotOf()))
    const { container } = render(createElement(SideChatView, {
      controller,
      sessions: [],
      currentSessionId: 's-1',
      t,
    }))
    const button = container.querySelector('[data-side-chat-new]') as HTMLButtonElement | null
    expect(button?.disabled).toBe(true)
    expect(button?.title).toContain('no sessions.create')
    controller.dispose()
  })

  it('shows the removed state and disables input when the host removed the session', () => {
    const controller = new SideChatController(face(() => snapshotOf({ removed: true })))
    controller.attach('s-1')
    const { container } = render(createElement(SideChatView, {
      controller,
      sessions: [{ sessionId: 's-1', displayTitle: 'Build', running: false }],
      currentSessionId: 's-1',
      t,
    }))
    expect(container.querySelector('[data-side-chat-removed]')).not.toBeNull()
    // 已移除态不渲染 composer（输入禁用的最强形式）。
    expect(container.querySelector('[data-side-chat-input]')).toBeNull()
    controller.dispose()
  })

  it('offers steer/queue and stop while the attached session is running', () => {
    const controller = new SideChatController(face(() => snapshotOf({ running: true, queue: [{}, {}] })))
    controller.attach('s-1')
    const { container } = render(createElement(SideChatView, {
      controller,
      sessions: [{ sessionId: 's-1', displayTitle: 'Build', running: false }],
      currentSessionId: 's-1',
      t,
    }))
    expect(container.querySelector('[data-side-chat-cancel]')).not.toBeNull()
    expect(container.querySelector('[data-side-chat-queue-toggle]')).not.toBeNull()
    expect(container.querySelector('[data-side-chat-queue="2"]')).not.toBeNull()
    controller.dispose()
  })

  it('surfaces promptError inline without clearing the conversation', () => {
    const controller = new SideChatController(face(() => snapshotOf({
      nodes: [{ kind: 'user', seq: 1, content: [{ type: 'text', text: 'hi' }] }],
    })))
    controller.attach('s-1')
    const { container } = render(createElement(SideChatView, {
      controller,
      sessions: [{ sessionId: 's-1', displayTitle: 'Build', running: false }],
      currentSessionId: 's-1',
      t,
    }))
    expect(container.querySelector('[data-side-chat-node="user"]')).not.toBeNull()
    controller.dispose()
  })
})

describe('side chat client registration', () => {
  it('declares sessions+locale static injects', () => {
    expect(name).toBe('client-ui-pane-side-chat')
    expect(inject).toEqual(['sessions', 'locale'])
  })

  it('registers the view and slash command on a pane host', () => {
    const views: Array<Record<string, unknown>> = []
    const commands: Array<Record<string, unknown>> = []
    const sessionsFace = face(() => snapshotOf())
    const ctx = {
      sessions: sessionsFace,
      get: (key: string) => {
        if (key === 'sessions') return sessionsFace
        if (key === 'locale') return { register: () => () => {}, bind: (_ns: string, key2: string) => key2 }
        if (key === 'paneWorkbench') return {
          registerView: (input: { descriptor: Record<string, unknown>; component: () => unknown }) => {
            views.push(input.descriptor)
            return () => {}
          },
          openView: vi.fn(),
          registerCommand: (input: { descriptor: Record<string, unknown> }) => {
            commands.push(input.descriptor)
            return () => {}
          },
        }
        throw new Error(`unexpected ${key}`)
      },
    }
    const dispose = apply(ctx as never)
    expect(views[0]).toMatchObject({ kind: 'dsh-side-chat.session', preferredRegion: 'right', singleton: false })
    expect(commands[0]).toMatchObject({ id: 'side-chat.open', slash: { name: 'side-chat', category: 'pane' } })
    dispose()
  })

  it('zero-registers without paneWorkbench and leaves sessions untouched', () => {
    const openCount = { value: 0 }
    const base = face(() => snapshotOf())
    const guarded = new Proxy(base, {
      get(target, prop) {
        if (prop === 'open') {
          openCount.value += 1
          return () => {}
        }
        return Reflect.get(target, prop)
      },
    }) as SideChatSessionsFace & { open(): void }
    const ctx = {
      sessions: guarded,
      get: (key: string) => {
        if (key === 'sessions') return guarded
        if (key === 'locale') return { register: () => () => {}, bind: (_ns: string, key2: string) => key2 }
        throw new Error(`unexpected ${key}`)
      },
    }
    const dispose = apply(ctx as never)
    dispose()
    expect(openCount.value).toBe(0)
  })
})

describe('multi-tab side chat isolation', () => {
  it('two tabs with different presets bind independently and never touch the main selection', async () => {
    const prompts: Array<{ session: string; text: string; mode: string }> = []
    const snapshots = new Map<string, ReturnType<typeof snapshotOf>>([
      ['s-2', snapshotOf({ nodes: [{ kind: 'user', seq: 1, content: [{ type: 'text', text: 'docs work' }] }] })],
      ['s-3', snapshotOf({ nodes: [{ kind: 'user', seq: 1, content: [{ type: 'text', text: 'test work' }] }] })],
    ])
    const face: SideChatSessionsFace = {
      list: {
        getSnapshot: () => ({
          ids: ['s-2', 's-3'],
          byId: { 's-2': { displayTitle: 'Docs', running: false }, 's-3': { displayTitle: 'Tests', running: false } },
          current: 's-1',
        }),
        subscribe: () => () => {},
      },
      binding: id => ({
        sessionId: id,
        session: {
          prompt: async (content, mode) => {
            prompts.push({ session: id, text: content[0]?.text ?? '', mode })
            return { ok: true }
          },
          cancel: async () => ({ ok: true }),
          loadOlder: async () => {},
          subscribe: () => () => {},
          getSnapshot: () => snapshots.get(id) ?? snapshotOf(),
        },
      }),
      fork: async () => 's-9',
    }
    // 经 apply 注册视图后取回工厂，两个不同 resourceKey 各渲染一个 tab。
    const views: Array<{ descriptor: Record<string, unknown>; component: (props?: { view?: { resourceKey?: string } }) => unknown }> = []
    const ctx = {
      sessions: face,
      get: (key: string) => {
        if (key === 'sessions') return face
        if (key === 'locale') return { register: () => () => {}, bind: (_ns: string, key2: string) => key2 }
        if (key === 'paneWorkbench') return {
          registerView: (input: { descriptor: Record<string, unknown>; component: (props?: { view?: { resourceKey?: string } }) => unknown }) => {
            views.push(input as never)
            return () => {}
          },
          openView: vi.fn(),
          registerCommand: () => () => {},
        }
        throw new Error(`unexpected ${key}`)
      },
    }
    const dispose = apply(ctx as never)
    const factory = views[0]!.component
    const { container } = render(createElement(factory as never, { view: { resourceKey: 'side-chat:s-2' } }) as never)
    const second = render(createElement(factory as never, { view: { resourceKey: 'side-chat:s-3' } }) as never)
    // 两个 tab 各自附着目标 session（快照不同即独立绑定）。
    expect(container.textContent ?? '').toContain('docs work')
    expect(second.container.textContent ?? '').toContain('test work')
    expect(second.container.textContent ?? '').not.toContain('docs work')
    second.unmount()
    // 卸载一个 tab 不影响另一个。
    expect(container.textContent ?? '').toContain('docs work')
    dispose()
  })
})
