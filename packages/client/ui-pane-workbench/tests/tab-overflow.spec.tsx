// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { PaneTabOverflow, PaneTabStrip } from '../src/tabs.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import {
  createPaneWorkspace,
  filterOverflowTabs,
  planPaneTabOverflow,
  reducePaneWorkspace,
  type PaneViewSpecV1,
} from '../src/workspace.js'

afterEach(cleanup)

function spec(index: number, extra: Partial<PaneViewSpecV1> = {}): PaneViewSpecV1 {
  return {
    kind: 'file.text',
    resourceKey: `file:tab-${index}`,
    role: 'content',
    preferredRegion: 'right',
    retention: 'recreate',
    singleton: false,
    preview: false,
    title: `Tab ${index}`,
    ...extra,
  }
}

function workspaceWithTabs(count: number) {
  let state = createPaneWorkspace()
  for (let index = 0; index < count; index += 1) {
    const pinned = index < 2
    const dirty = index === 3
    state = reducePaneWorkspace(state, {
      type: 'open_view',
      request: spec(index, { pinned, preview: false, dirty, duplicate: true }),
    }).state
  }
  return state
}

describe('V4 Task 3.3 Tab Overflow', () => {
  it('keeps active pinned and dirty tabs visible inside a 390px budget', () => {
    const state = workspaceWithTabs(20)
    const group = state.groups['group:right:content']!
    const plan = planPaneTabOverflow(group, state.views, 390)
    expect(plan.visibleIds).toContain(group.activeTabId)
    for (const viewId of group.tabs) {
      const view = state.views[viewId]!
      if (view.pinned || view.dirty) expect(plan.visibleIds).toContain(viewId)
    }
    expect(plan.overflowIds.length).toBeGreaterThan(0)
    expect(plan.visibleIds.some(id => plan.overflowIds.includes(id))).toBe(false)
  })

  it('bounds measurement and observers for a 50-tab fixture', () => {
    const state = workspaceWithTabs(50)
    const group = state.groups['group:right:content']!
    const plan = planPaneTabOverflow(group, state.views, 390)
    expect(plan.measuredCount).toBeLessThanOrEqual(30)
    expect(plan.observerCount).toBe(1)
    expect(plan.overflowIds.length).toBeGreaterThan(20)
    const matches = filterOverflowTabs(plan.overflowIds, state.views, 'Tab 40')
    expect(matches.some(id => state.views[id]?.title === 'Tab 40')).toBe(true)
  })

  it('restores focus from More Tabs without activating hidden view bodies', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    let mounts = 0
    registry.registerView({
      descriptor: {
        kind: 'file.text',
        label: 'File',
        componentKey: 'file',
        role: 'content',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: false,
      },
      component: () => {
        mounts += 1
        return createElement('p', { 'data-pane-view-body': true }, 'body')
      },
    })
    const controller = new PaneWorkbenchController({
      registry,
      initialState: workspaceWithTabs(50),
    })
    const state = controller.getSnapshot()
    const group = state.groups['group:right:content']!
    const plan = planPaneTabOverflow(group, state.views, 390)
    const hidden = plan.overflowIds.at(-1)!
    render(createElement(PaneTabStrip, {
      group,
      state,
      controller,
      availableWidth: 390,
      onContextMenu: () => {},
    }))
    expect(document.querySelectorAll('[data-pane-view-body]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'More Tabs' }))
    const option = screen.getByRole('option', { name: new RegExp(state.views[hidden]!.title) })
    fireEvent.click(option)
    expect(controller.getSnapshot().groups[group.id]?.activeTabId).toBe(hidden)
    expect(mounts).toBe(0)
  })

  it('filters the overflow listbox by title and status', () => {
    const state = workspaceWithTabs(12)
    const group = state.groups['group:right:content']!
    const overflowIds = group.tabs.slice(4)
    render(createElement(PaneTabOverflow, {
      group,
      views: state.views,
      overflowIds,
      controller: new PaneWorkbenchController({ initialState: state }),
    }))
    fireEvent.click(screen.getByRole('button', { name: 'More Tabs' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Tab 8' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })
})
