// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubagentMonitorController, type SubagentSessionListLike } from '../src/controller.js'
import { SubagentMonitorView } from '../src/view.js'
import { subagentEn } from '../src/labels.js'

afterEach(cleanup)

function controllerWith(snapshot: SubagentSessionListLike) {
  const listeners = new Set<() => void>()
  const controller = new SubagentMonitorController({
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    refresh: () => {},
    openSubagent: vi.fn(),
  })
  return controller
}

describe('SubagentMonitorView', () => {
  it('renders an English empty session without an unstable snapshot loop', () => {
    const controller = controllerWith({ byId: {}, subagentsByParent: {} })
    expect(controller.getSnapshot()).toBe(controller.getSnapshot())
    render(createElement(SubagentMonitorView, { controller, t: key => subagentEn[key] }))
    expect(screen.getByText('No session selected')).toBeTruthy()
    controller.dispose()
  })

  it('searches loaded descendants, restores focus, and ignores late detail feedback for a different target', async () => {
    const snapshot: SubagentSessionListLike = { current: 'other-session', byId: {}, subagentsByParent: {
      root: { state: 'ready', entries: [{ id: 'parent', kind: 'child', label: 'Research', mode: 'continuable', hasChildren: true }] },
      parent: { state: 'ready', entries: [{ id: 'child', kind: 'child', label: 'Review', mode: 'continuable', activity: 'running' }] },
    } }
    let finish: (result: { ok: boolean; summary: string }) => void = () => {}
    const history = vi.fn(() => new Promise<{ ok: boolean; summary: string }>(resolve => { finish = resolve }))
    const controller = new SubagentMonitorController({ getSnapshot: () => snapshot, subscribe: () => () => {}, refresh: vi.fn(), openSubagent: vi.fn(), detail: { history, prompt: vi.fn(), interrupt: vi.fn() } }, 'root')
    render(createElement(SubagentMonitorView, { controller }))
    fireEvent.change(screen.getByLabelText('搜索子 Agent'), { target: { value: 'Review' } })
    const child = screen.getByRole('button', { name: /Review可继续/ })
    child.focus(); fireEvent.click(child)
    expect(screen.getByRole('heading', { name: 'Review' })).toBe(document.activeElement)
    fireEvent.click(screen.getByRole('button', { name: '查看最近记录' }))
    fireEvent.click(screen.getByRole('button', { name: '返回列表' }))
    await waitFor(() => expect(document.activeElement).toBe(child))
    fireEvent.change(screen.getByLabelText('搜索子 Agent'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Research可继续/ }))
    await act(async () => { finish({ ok: true, summary: 'OLD TARGET RESULT' }) })
    expect(screen.queryByText('OLD TARGET RESULT')).toBeNull()
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ parentSessionId: 'parent', childSessionId: 'child' }), { maxMessages: 20 })
    controller.dispose()
  })
  it('renders running/inactive nodes and summary', () => {
    const controller = controllerWith({
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
    const view = render(createElement(SubagentMonitorView, { controller }))
    expect(screen.getByText(/1 运行中/iu)).toBeTruthy()
    expect(view.container.querySelector('[data-pane-subagent-node="child-a"]')).toBeTruthy()
    controller.dispose()
  })

  it('expands branches and keeps detail visible', () => {
    const controller = controllerWith({
      current: 'root',
      byId: {},
      subagentsByParent: {
        root: {
          state: 'ready',
          entries: [{ id: 'parent', kind: 'child', mode: 'continuable', label: 'parent', activity: 'inactive', hasChildren: true }],
        },
        parent: {
          state: 'ready',
          entries: [{ id: 'child', kind: 'child', mode: 'one-shot', label: 'child', activity: 'inactive', hasChildren: false }],
        },
      },
    })
    const view = render(createElement(SubagentMonitorView, { controller }))
    expect(view.container.querySelector('[data-pane-subagent-node="child"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '展开 parent' }))
    expect(view.container.querySelector('[data-pane-subagent-node="child"]')).toBeTruthy()
    controller.dispose()
  })

  it('renders a truthful empty state and no no-op parallel control', () => {
    const controller = controllerWith({ current: 'root', byId: {}, subagentsByParent: {} })
    render(createElement(SubagentMonitorView, { controller }))
    expect(screen.getByText('当前会话还没有子 Agent')).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
    controller.dispose()
  })

  it('selects a node locally without forcing main-session navigation', () => {
    const controller = controllerWith({
      current: 'root',
      byId: {},
      subagentsByParent: {
        root: {
          state: 'ready',
          entries: [{ id: 'child-a', kind: 'child', mode: 'continuable', label: 'child-a', activity: 'running', hasChildren: false }],
        },
      },
    })
    const open = vi.spyOn(controller, 'openInMain')
    render(createElement(SubagentMonitorView, { controller }))
    fireEvent.click(screen.getByRole('button', { name: /child-a可继续/iu }))
    expect(screen.getByText('查看最近记录')).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
    controller.dispose()
  })
})
