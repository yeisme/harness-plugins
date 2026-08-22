// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaneWorkbenchChrome, PaneWorkbenchController, PaneViewRegistry, createPaneWorkspace, reducePaneWorkspace } from '../src/index.js'
import { pluginDefinition } from './fixtures.js'

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function stateWithView() {
  return reducePaneWorkspace(createPaneWorkspace(), {
    type: 'open_view',
    request: {
      kind: 'pinax.notes-preview.view',
      resourceKey: 'artifact:notes:1',
      role: 'content',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: false,
      preview: false,
      pinned: true,
    },
  }).state
}

function stateWithTwoViews() {
  return reducePaneWorkspace(stateWithView(), {
    type: 'open_view',
    request: {
      kind: 'pinax.notes-preview.view',
      resourceKey: 'artifact:notes:2',
      role: 'content',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: false,
      preview: false,
      pinned: true,
    },
  }).state
}

function stateWithRightAndBottomViews() {
  return reducePaneWorkspace(stateWithView(), {
    type: 'open_view',
    request: {
      kind: 'pinax.notes-preview.view',
      resourceKey: 'artifact:notes:utility',
      role: 'utility',
      preferredRegion: 'bottom',
      retention: 'recreate',
      singleton: false,
      preview: false,
      pinned: true,
    },
  }).state
}

function registryFor(component: (props: { readonly retry: () => void }) => unknown) {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: {
      ...pluginDefinition('pinax.notes-preview').views[0],
      kind: 'pinax.notes-preview.view',
    },
    component,
  })
  return registry
}

describe('PaneWorkbenchChrome view boundary', () => {
  it('renders explicit region chrome, accessible tabs, and an orphan recovery state', () => {
    const state = stateWithView()
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    const { unmount } = render(createElement(PaneWorkbenchChrome, { defaultVisible: true, initialState: state, registry }))
    expect(document.querySelector('[data-pane-region="right"]')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /artifact:notes/iu }).getAttribute('aria-selected')).toBe('true')
    unmount()

    const orphanRegistry = new PaneViewRegistry({ capabilities: new Set() })
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true, initialState: state, registry: orphanRegistry }))
    expect(document.querySelector('[data-pane-orphaned]')?.textContent).toContain('provider is not enabled')
    expect(screen.getByRole('button', { name: 'Close Tab' })).toBeTruthy()
  })

  it('keeps tab keyboard movement and close local to the reducer', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true, initialState: stateWithView(), registry }))
    const tab = screen.getByRole('tab')
    fireEvent.keyDown(tab, { key: 'Delete' })
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('supports roving tab focus, Enter/Space activation and focus return after Delete', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true, initialState: stateWithTwoViews(), registry }))
    const tabs = screen.getAllByRole('tab')
    expect(tabs.filter(tab => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1)
    expect(tabs.filter(tab => tab.getAttribute('tabindex') === '0')).toHaveLength(1)

    const inactive = tabs.find(tab => tab.getAttribute('aria-selected') !== 'true')!
    fireEvent.keyDown(inactive, { key: 'Enter' })
    expect(inactive.getAttribute('aria-selected')).toBe('true')
    expect(inactive.getAttribute('tabindex')).toBe('0')

    fireEvent.keyDown(inactive, { key: 'Delete' })
    const remaining = screen.getAllByRole('tab')[0]!
    expect(document.activeElement?.id).toBe(remaining.id)
    fireEvent.keyDown(remaining, { key: ' ' })
    expect(remaining.getAttribute('aria-selected')).toBe('true')
  })

  it('offers keyboard move mode and split actions through the tab menu with live feedback', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    let latest = stateWithView()
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true,
      initialState: latest,
      registry,
      onStateChange: state => { latest = state },
    }))
    const tab = screen.getByRole('tab')
    fireEvent.keyDown(tab, { key: 'F10', shiftKey: true })
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move by Keyboard' }))
    const dialog = screen.getByRole('dialog', { name: 'Keyboard move mode' })
    expect(dialog.textContent).toContain('Arrow/Home/End')
    fireEvent.keyDown(dialog, { key: 'End' })
    expect(document.querySelector('[aria-live]')?.textContent).toContain('Press Enter')
    fireEvent.keyDown(dialog, { key: 'Enter' })
    expect(screen.queryByRole('dialog', { name: 'Keyboard move mode' })).toBeNull()
    expect(latest.generation).toBeGreaterThan(0)

    fireEvent.keyDown(screen.getAllByRole('tab')[0]!, { key: 'F10', shiftKey: true })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split Left' }))
    expect(latest.generation).toBeGreaterThanOrEqual(1)
    expect(document.querySelector('[aria-live]')?.textContent).toMatch(/pane|moved|split/iu)
  })

  it('previews a resize locally, flushes the last pointer frame, and commits once', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    let latest = stateWithView()
    let changes = 0
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true,
      initialState: latest,
      registry,
      onStateChange: state => { latest = state; changes += 1 },
    }))
    const divider = screen.getByRole('separator')
    const workbench = screen.getByRole('complementary', { name: 'Pane Workbench' })
    fireEvent.pointerDown(divider)
    expect(workbench.getAttribute('data-pane-resizing')).toBe('true')
    fireEvent.pointerMove(divider, { clientX: 0.3 })
    fireEvent.pointerMove(divider, { clientX: 0.6 })
    fireEvent.pointerUp(divider)
    expect(workbench.getAttribute('data-pane-resizing')).toBeNull()
    expect(changes).toBe(1)
    expect(latest.regions.right.size).toBeCloseTo(0.6)
  })

  it('shows edge markers and atomically splits a dragged tab within a pane', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    let latest = stateWithTwoViews()
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true,
      initialState: latest,
      registry,
      onStateChange: state => { latest = state },
    }))
    const group = document.querySelector('section[data-pane-group="group:right:content"]') as HTMLElement
    vi.spyOn(group, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100,
      toJSON: () => ({}),
    })
    const source = screen.getAllByRole('tab')[0]!
    fireEvent.pointerDown(source, { clientX: 50, clientY: 50 })
    fireEvent.pointerMove(group, { clientX: 96, clientY: 50 })
    expect(group.getAttribute('data-pane-drop-edge')).toBe('right')
    expect(group.querySelector('[data-pane-insertion-marker="right"]')?.getAttribute('data-pane-insertion-marker-enabled')).toBe('true')
    fireEvent.pointerUp(group)
    expect(group.getAttribute('data-pane-drop-edge')).toBeNull()
    expect(Object.values(latest.groups).filter(candidate => candidate.region === 'right')).toHaveLength(3)
    expect(Object.values(latest.views).find(view => view.resourceKey === 'artifact:notes:1')?.groupId).not.toBe('group:right:content')
  })

  it('reorders tabs through the same pointer session when the center target is another tab', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    let latest = stateWithTwoViews()
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true,
      initialState: latest,
      registry,
      onStateChange: state => { latest = state },
    }))
    const tabs = screen.getAllByRole('tab')
    const source = tabs[0]!
    const target = tabs[1]!
    const group = document.querySelector('section[data-pane-group="group:right:content"]') as HTMLElement
    const targetViewId = target.id.replace('pane-tab-', '')
    fireEvent.pointerDown(source, { clientX: 0, clientY: 5 })
    fireEvent.pointerMove(target, { clientX: 90, clientY: 5 })
    expect(group.getAttribute('data-pane-drop-edge')).toBe('center')
    expect(group.getAttribute('data-pane-drop-index')).toBe('1')
    fireEvent.pointerUp(target)
    expect(latest.groups['group:right:content']?.tabs.at(-1)).toBe(source.id.replace('pane-tab-', ''))
    expect(latest.groups['group:right:content']?.tabs[0]).toBe(targetViewId)
  })

  it('keeps the source tab on an invalid center drop and moves it atomically across regions', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    let latest = stateWithRightAndBottomViews()
    let changes = 0
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true,
      initialState: latest,
      registry,
      onStateChange: state => { latest = state; changes += 1 },
    }))
    const source = screen.getAllByRole('tab').find(tab => tab.id.includes('view:pinax.notes-preview.view'))!
    const sourceViewId = source.id.replace('pane-tab-', '')
    const contentGroup = document.querySelector('section[data-pane-group="group:right:content"]') as HTMLElement
    vi.spyOn(contentGroup, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100,
      toJSON: () => ({}),
    })
    const beforeGroupId = latest.views[sourceViewId]?.groupId
    fireEvent.pointerDown(source, { clientX: 50, clientY: 50 })
    fireEvent.pointerMove(contentGroup, { clientX: 60, clientY: 50 })
    expect(contentGroup.querySelector('[data-pane-insertion-marker="center"]')?.getAttribute('data-pane-insertion-marker-enabled')).toBe('false')
    fireEvent.pointerUp(contentGroup)
    expect(changes).toBe(0)
    expect(latest.views[sourceViewId]?.groupId).toBe(beforeGroupId)

    const bottomGroup = document.querySelector('section[data-pane-group="group:bottom:utility"]') as HTMLElement
    vi.spyOn(bottomGroup, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100,
      toJSON: () => ({}),
    })
    fireEvent.pointerDown(source, { clientX: 50, clientY: 50 })
    fireEvent.pointerMove(bottomGroup, { clientX: 60, clientY: 50 })
    expect(bottomGroup.getAttribute('data-pane-drop-edge')).toBe('center')
    fireEvent.pointerUp(bottomGroup)
    expect(latest.views[sourceViewId]?.groupId).toBe('group:bottom:utility')
  })

  it('toggles the whole workbench overlay and releases pointer events when closed', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true, initialState: stateWithView(), registry }))
    const workbench = screen.getByRole('complementary', { name: 'Pane Workbench' })
    expect(workbench.getAttribute('data-pane-workbench-visible')).toBe('true')
    expect(workbench.style.pointerEvents).toBe('auto')

    fireEvent.click(screen.getByRole('button', { name: 'Hide Pane Workbench' }))
    const collapsed = screen.getByRole('complementary', { name: 'Pane Workbench' })
    expect(collapsed.getAttribute('data-pane-workbench-visible')).toBe('false')
    expect(collapsed.style.pointerEvents).toBe('none')
    expect(collapsed.querySelector('[data-pane-region]')).toBeNull()
    const show = screen.getByRole('button', { name: 'Show Pane Workbench' })
    expect(show.getAttribute('aria-expanded')).toBe('false')
    expect(show.style.pointerEvents).toBe('auto')

    fireEvent.click(show)
    expect(screen.getByRole('complementary', { name: 'Pane Workbench' }).getAttribute('data-pane-workbench-visible')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Hide Pane Workbench' })).toBeTruthy()
  })

  it('clears a captured error with Retry', () => {
    let shouldThrow = true
    const registry = registryFor(() => {
      if (shouldThrow) throw new Error('view crashed')
      return createElement('p', null, 'Recovered view')
    })
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true, initialState: stateWithView(), registry }))
    expect(screen.getByRole('alert')).toBeTruthy()
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByText('Recovered view')).toBeTruthy()
  })

  it('increments the observable generation and remounts on Reload View', () => {
    let shouldThrow = true
    let mounts = 0
    const registry = registryFor(() => {
      useEffect(() => { mounts += 1 }, [])
      if (shouldThrow) throw new Error('view crashed')
      return createElement('p', null, `Recovered view ${mounts}`)
    })
    render(createElement(PaneWorkbenchChrome, { defaultVisible: true, initialState: stateWithView(), registry }))
    expect(screen.getByRole('alert').getAttribute('data-pane-view-generation')).toBe('0')
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Reload View' }))
    expect(screen.getByText('Recovered view 0')).toBeTruthy()
    expect(document.querySelector('[data-pane-view-generation]')?.getAttribute('data-pane-view-generation')).toBe('1')
    expect(mounts).toBe(1)
  })

  it('starts collapsed by default and expands through the controller', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    const controller = new PaneWorkbenchController()
    render(createElement(PaneWorkbenchChrome, { initialState: stateWithView(), registry, controller }))
    expect(screen.getByRole('complementary', { name: 'Pane Workbench' }).getAttribute('data-pane-workbench-visible')).toBe('false')
    expect(screen.queryByRole('tab')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show Pane Workbench' }))
    expect(screen.getByRole('complementary', { name: 'Pane Workbench' }).getAttribute('data-pane-workbench-visible')).toBe('true')
    expect(screen.getByRole('tab')).toBeTruthy()
  })

  it('external openView auto-expands the chrome through the controller', () => {
    const registry = registryFor(() => createElement('p', null, 'Ready view'))
    const controller = new PaneWorkbenchController()
    render(createElement(PaneWorkbenchChrome, { initialState: createPaneWorkspace(), registry, controller }))
    expect(screen.getByRole('complementary', { name: 'Pane Workbench' }).getAttribute('data-pane-workbench-visible')).toBe('false')

    act(() => controller.openView({
      kind: 'pinax.notes-preview.view',
      resourceKey: 'artifact:notes:1',
      role: 'content',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: false,
      pinned: true,
    }))
    expect(screen.getByRole('complementary', { name: 'Pane Workbench' }).getAttribute('data-pane-workbench-visible')).toBe('true')
    expect(screen.getByRole('tab')).toBeTruthy()
  })

})
