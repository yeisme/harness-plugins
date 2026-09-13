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
  it('keeps two bound roots isolated when the global selection changes and rejects a stale child target', async () => {
    const initial: SubagentSessionListLike = { current: 'root-a', byId: {}, subagentsByParent: {
      'root-a': { state: 'ready', entries: [{ id: 'a', kind: 'child', mode: 'continuable', label: 'A' }] },
      'root-b': { state: 'ready', entries: [{ id: 'b', kind: 'child', mode: 'continuable', label: 'B' }] },
    } }
    const harness = makeEnv(initial)
    const prompt = vi.fn(async () => ({ ok: true }))
    const a = new SubagentMonitorController({ ...harness.env, detail: { prompt, history: vi.fn(), interrupt: vi.fn() } }, 'root-a')
    const b = new SubagentMonitorController(harness.env, 'root-b')
    const child = a.getSnapshot().nodes[0]!
    harness.setSnapshot({ ...initial, current: 'root-b' })
    expect(a.getSnapshot().nodes[0]!.ref).toBe('a')
    expect(b.getSnapshot().nodes[0]!.ref).toBe('b')
    a.refresh(); expect(harness.refresh).toHaveBeenCalledWith('root-a')
    expect((await a.send(b.getSnapshot().nodes[0]!, 'follow-up')).ok).toBe(false)
    harness.setSnapshot({ ...initial, subagentsByParent: { 'root-a': { state: 'ready', entries: [] } } })
    expect((await a.send(child, 'follow-up')).ok).toBe(false)
    expect(prompt).not.toHaveBeenCalled(); expect(harness.openSubagent).not.toHaveBeenCalled()
    a.dispose(); b.dispose(); expect(harness.listeners.size).toBe(0)
  })

  it('opens alongside through a capability-gated port without changing the main session', () => {
    const harness = makeEnv({ current: 'root', byId: {}, subagentsByParent: { root: { state: 'ready', entries: [{ id: 'child', kind: 'child', mode: 'continuable' }] } } })
    let available = false; const openAlongside = vi.fn()
    const controller = new SubagentMonitorController({ ...harness.env, openAlongside, canOpenAlongside: () => available }, 'root')
    const child = controller.getSnapshot().nodes[0]!
    controller.openAlongside(child); expect(openAlongside).not.toHaveBeenCalled()
    available = true; controller.openAlongside(child)
    expect(openAlongside).toHaveBeenCalledWith({ parentSessionId: 'root', childSessionId: 'child', mode: 'continuable' })
    expect(harness.openSubagent).not.toHaveBeenCalled(); controller.dispose()
  })

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
