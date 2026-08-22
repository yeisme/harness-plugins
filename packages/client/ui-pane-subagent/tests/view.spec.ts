// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubagentMonitorController, type SubagentSessionListLike } from '../src/controller.js'
import { SubagentMonitorView } from '../src/view.js'

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
