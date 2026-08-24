// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { PaneTab, TabStatusPresenter } from '../src/tabs.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import {
  createPaneWorkspace,
  presentPaneTab,
  reducePaneWorkspace,
  segmentPaneTabs,
  type PaneViewSpecV1,
  type PaneWorkspaceV1,
} from '../src/workspace.js'

afterEach(cleanup)

function view(request: Partial<PaneViewSpecV1> & Pick<PaneViewSpecV1, 'kind' | 'resourceKey'>): PaneViewSpecV1 {
  return {
    role: 'content',
    preferredRegion: 'right',
    retention: 'recreate',
    singleton: false,
    preview: true,
    ...request,
  }
}

function apply(state: PaneWorkspaceV1, intent: Parameters<typeof reducePaneWorkspace>[1]): PaneWorkspaceV1 {
  const result = reducePaneWorkspace(state, intent)
  expect(result.accepted, result.reason).toBe(true)
  return result.state
}

function viewByResource(state: PaneWorkspaceV1, resourceKey: string) {
  return Object.values(state.views).find(candidate => candidate.resourceKey === resourceKey)
}

describe('V4 Task 3.2 Tab Lifecycle', () => {
  it('keeps pinned tabs in the pinned segment while preview replaces preview', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:pin-a', pinned: true, preview: false, title: 'A' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:pin-b', pinned: true, preview: false, title: 'B' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:preview-a', preview: true, title: 'PA' }) })
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:preview-b', preview: true, title: 'PB' }) })
    expect(viewByResource(state, 'file:pin-a')?.pinned).toBe(true)
    expect(viewByResource(state, 'file:pin-b')?.pinned).toBe(true)
    expect(viewByResource(state, 'file:preview-a')).toBeUndefined()
    const group = state.groups['group:right:content']!
    const segments = segmentPaneTabs(group, state.views)
    expect(segments[0]?.id).toBe('pinned')
    expect(segments[0]?.viewIds).toEqual([
      viewByResource(state, 'file:pin-a')!.id,
      viewByResource(state, 'file:pin-b')!.id,
    ])
    expect(segments[1]?.viewIds).toEqual([viewByResource(state, 'file:preview-b')!.id])
  })

  it('commits preview to pinned on dirty without changing the view id', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:edit', preview: true }) })
    const opened = viewByResource(state, 'file:edit')!
    state = apply(state, { type: 'set_view_dirty', viewId: opened.id, dirty: true })
    const committed = viewByResource(state, 'file:edit')!
    expect(committed.id).toBe(opened.id)
    expect(committed.preview).toBe(false)
    expect(committed.pinned).toBe(true)
    expect(committed.dirty).toBe(true)
  })

  it('dedupes same resource and only duplicates when asked', () => {
    let state = createPaneWorkspace()
    state = apply(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:same', preview: false }) })
    const first = viewByResource(state, 'file:same')!
    const reused = reducePaneWorkspace(state, { type: 'open_view', request: view({ kind: 'file.text', resourceKey: 'file:same', preview: false }) })
    expect(reused.reason).toBe('reused')
    expect(Object.values(reused.state.views)[0]?.id).toBe(first.id)
    const duplicated = reducePaneWorkspace(reused.state, {
      type: 'open_view',
      request: view({ kind: 'file.text', resourceKey: 'file:same', preview: false, duplicate: true }),
    })
    expect(duplicated.accepted).toBe(true)
    expect(duplicated.reason).toBe('duplicated')
    const copies = Object.values(duplicated.state.views).filter(item => item.resourceKey === 'file:same')
    expect(copies).toHaveLength(2)
    expect(copies.some(item => item.instanceLabel !== undefined)).toBe(true)
  })

  it('presents dirty orphaned tabs with tokens rather than color-only fields', () => {
    const presentation = presentPaneTab({
      id: 'view:orphan',
      kind: 'file.text',
      resourceKey: 'file:orphan',
      role: 'content',
      region: 'right',
      groupId: 'group:right:content',
      title: 'orphan.md',
      retention: 'recreate',
      singleton: false,
      preview: false,
      pinned: true,
      dirty: true,
      duplicate: false,
      closePolicy: 'confirm',
      status: 'orphaned',
      attention: false,
      offline: true,
      stale: false,
    })
    expect(presentation.statusTokens).toEqual(expect.arrayContaining(['dirty', 'orphaned', 'offline', 'close:confirm']))
    expect(presentation.accessibleName).toContain('orphan.md')
    expect(presentation.accessibleName).toContain('dirty')
    const { container } = render(createElement(TabStatusPresenter, {
      view: { dirty: true, attention: false, offline: true, status: 'orphaned' },
      isActive: true,
    }))
    expect(container.querySelector('[data-pane-status="dirty"]')?.textContent).toBe('Unsaved changes')
    expect(container.querySelector('[data-pane-status="orphaned"]')?.textContent).toBe('Unavailable')
    expect(container.querySelector('[data-pane-status="offline"]')?.textContent).toBe('Offline')
  })

  it('keeps the same renderer id when a preview tab is pinned in the component', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
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
      component: () => createElement('p', null, 'body'),
    })
    const controller = new PaneWorkbenchController({ registry })
    controller.openView(view({ kind: 'file.text', resourceKey: 'file:keep', preview: true, title: 'keep.md' }))
    const opened = viewByResource(controller.getSnapshot(), 'file:keep')!
    const group = controller.getSnapshot().groups[opened.groupId]!
    const first = render(createElement(PaneTab, {
      view: opened,
      isActive: true,
      isPinned: false,
      tabIndex: 0,
      group,
      controller,
      onContextMenu: () => {},
    }))
    expect(first.container.querySelector('[data-pane-renderer-id]')?.getAttribute('data-pane-renderer-id')).toBe(opened.id)
    controller.dispatch({ type: 'pin_view', viewId: opened.id, pinned: true })
    const pinned = viewByResource(controller.getSnapshot(), 'file:keep')!
    first.rerender(createElement(PaneTab, {
      view: pinned,
      isActive: true,
      isPinned: true,
      tabIndex: 0,
      group: controller.getSnapshot().groups[pinned.groupId]!,
      controller,
      onContextMenu: () => {},
    }))
    expect(pinned.id).toBe(opened.id)
    expect(first.container.querySelector('[data-pane-renderer-id]')?.getAttribute('data-pane-renderer-id')).toBe(opened.id)
  })
})
