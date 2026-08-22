import { describe, expect, it, vi } from 'vitest'
import { SubagentMonitorController, type SubagentSessionListLike } from '../src/controller.js'

function makeEnv(initial: SubagentSessionListLike) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  const refresh = vi.fn()
  const openSubagent = vi.fn()
  return {
    env: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      refresh,
      openSubagent,
    },
    setSnapshot(next: SubagentSessionListLike) {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
    listeners,
    refresh,
    openSubagent,
  }
}

const empty: SubagentSessionListLike = { current: undefined, byId: {}, subagentsByParent: {} }

describe('SubagentMonitorController', () => {
  it('projects the current root and invalidates on snapshot change', () => {
    const harness = makeEnv(empty)
    const controller = new SubagentMonitorController(harness.env)
    expect(controller.getSnapshot().rootSessionId).toBe('')

    harness.setSnapshot({
      current: 'root',
      byId: {
        'child-a': { id: 'child-a', displayTitle: 'child-a', running: true },
      },
      subagentsByParent: {
        root: {
          state: 'ready',
          entries: [{ id: 'child-a', kind: 'child', mode: 'continuable', label: 'child-a', activity: 'running', hasChildren: false }],
        },
      },
    })
    expect(controller.getSnapshot().runningCount).toBe(1)
    expect(controller.getSnapshot().generation).toBeGreaterThan(0)
    controller.dispose()
  })

  it('forwards refresh and openInMain through the environment', () => {
    const harness = makeEnv({
      current: 'root',
      byId: {},
      subagentsByParent: {
        root: { state: 'ready', entries: [{ id: 'a', kind: 'child', mode: 'one-shot', label: 'a', activity: 'inactive', hasChildren: false }] },
      },
    })
    const controller = new SubagentMonitorController(harness.env)
    controller.refresh()
    expect(harness.refresh).toHaveBeenCalledWith('root')

    const node = controller.getSnapshot().nodes[0]!
    controller.openInMain(node)
    expect(harness.openSubagent).toHaveBeenCalledWith({ parentSessionId: 'root', childSessionId: 'a', mode: 'one-shot' })
    controller.dispose()
  })
})

describe('SubagentMonitorController detail port', () => {
  it('forwards peek/send/interrupt to the detail port', async () => {
    const history = vi.fn().mockResolvedValue({ ok: true, summary: '3 events' })
    const prompt = vi.fn().mockResolvedValue({ ok: true })
    const interrupt = vi.fn().mockResolvedValue({ ok: true })
    const env = {
      getSnapshot: () => ({
        current: 'root',
        byId: {},
        subagentsByParent: {
          root: { state: 'ready', entries: [{ id: 'a', kind: 'child', mode: 'continuable', label: 'a', activity: 'running', hasChildren: false }] },
        },
      }),
      subscribe: () => () => {},
      refresh: vi.fn(),
      openSubagent: vi.fn(),
      detail: { history, prompt, interrupt },
    }
    const controller = new SubagentMonitorController(env)
    const node = controller.getSnapshot().nodes[0]!
    await controller.peek(node)
    expect(history).toHaveBeenCalledWith({ parentSessionId: 'root', childSessionId: 'a', mode: 'continuable' }, { maxMessages: 20 })
    await controller.send(node, 'hello')
    expect(prompt).toHaveBeenCalledWith({ parentSessionId: 'root', childSessionId: 'a', mode: 'continuable' }, 'hello')
    await controller.interrupt(node)
    expect(interrupt).toHaveBeenCalledWith({ parentSessionId: 'root', childSessionId: 'a', mode: 'continuable' })
    controller.dispose()
  })

  it('rejects detail actions for one-shot subagents', async () => {
    const prompt = vi.fn()
    const interrupt = vi.fn()
    const env = {
      getSnapshot: () => ({
        current: 'root',
        byId: {},
        subagentsByParent: {
          root: { state: 'ready', entries: [{ id: 'a', kind: 'child', mode: 'one-shot', label: 'a', activity: 'inactive', hasChildren: false }] },
        },
      }),
      subscribe: () => () => {},
      refresh: vi.fn(),
      openSubagent: vi.fn(),
      detail: { history: vi.fn(), prompt, interrupt },
    }
    const controller = new SubagentMonitorController(env)
    const node = controller.getSnapshot().nodes[0]!
    expect((await controller.send(node, 'hello')).ok).toBe(false)
    expect((await controller.interrupt(node)).ok).toBe(false)
    expect(prompt).not.toHaveBeenCalled()
    expect(interrupt).not.toHaveBeenCalled()
    controller.dispose()
  })
})
