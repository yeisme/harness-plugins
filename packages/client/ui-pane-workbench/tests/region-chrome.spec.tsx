// @vitest-environment jsdom
import { createElement, useEffect, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { openPaneWorkbenchCoreView, registerPaneWorkbenchCoreViews } from '../src/core-pane.js'
import { PaneRegionChrome, REGION_STYLES, paneDropTargetLabel, resolveHiddenBottomDropPhase } from '../src/region-chrome.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { setActiveLocale } from '../src/i18n/locale.js'

afterEach(() => { setActiveLocale('en'); cleanup() })

function fixture(includeBottom = true) {
  let fileMounts = 0
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: { kind: 'file.preview', label: 'File Preview', componentKey: 'file-preview', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: false },
    component: () => { useEffect(() => { fileMounts += 1 }, []); return createElement('p', null, 'File content') },
  })
  registry.registerView({
    descriptor: { kind: 'terminal.session', label: 'Terminal', componentKey: 'terminal', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: false },
    component: () => createElement('p', null, 'Terminal content'),
  })
  registry.registerView({
    descriptor: { kind: 'notifications.view', label: 'Notifications', componentKey: 'notifications', role: 'inspector', preferredRegion: 'right', retention: 'recreate', singleton: true },
    component: () => createElement('p', null, 'Notification content'),
  })
  const controller = new PaneWorkbenchController({ registry })
  controller.openView({ kind: 'file.preview', resourceKey: 'file:README.md', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: false, pinned: true, title: 'README.md' })
  if (includeBottom) controller.openView({ kind: 'terminal.session', resourceKey: 'terminal:one', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: false, pinned: true, title: 'Terminal 1' })
  return { registry, controller, getFileMounts: () => fileMounts }
}

function Regions(props: ReturnType<typeof fixture> & { rightMode?: 'rail' | 'dock'; renderCoreView?: (id: 'dsh.tool-details') => ReactNode }) {
  return createElement('div', null,
    createElement(PaneRegionChrome, { region: 'right', mode: props.rightMode ?? 'dock', width: props.rightMode === 'rail' ? 44 : 480, height: 800, visible: true, maximized: false, registry: props.registry, controller: props.controller, renderCoreView: props.renderCoreView }),
    createElement(PaneRegionChrome, { region: 'bottom', mode: 'dock', width: 900, height: 280, visible: true, maximized: false, registry: props.registry, controller: props.controller, renderCoreView: props.renderCoreView }),
  )
}

describe('PaneRegionChrome shared dual-slot host', () => {
  it('renders contextual tabs in their canonical regions and moves one through the keyboard-accessible menu', () => {
    const f = fixture()
    render(createElement(Regions, f))
    const right = screen.getByRole('complementary', { name: 'Right workspace' })
    const bottom = screen.getByRole('complementary', { name: 'Bottom workspace' })
    expect(within(right).getByRole('tab', { name: 'README.md' })).toBeTruthy()
    expect(within(bottom).getByRole('tab', { name: 'Terminal 1' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Notifications' })).toBeNull()

    fireEvent.keyDown(within(right).getByRole('tab', { name: 'README.md' }), { key: 'F10', shiftKey: true })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Bottom' }))
    expect(within(bottom).getByRole('tab', { name: 'README.md' })).toBeTruthy()
    expect(within(right).queryByRole('tab', { name: 'README.md' })).toBeNull()
  })

  it('opens the + selector from the activity rail without synthesizing fixed module tabs', () => {
    const f = fixture()
    render(createElement(Regions, { ...f, rightMode: 'rail' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Open workspace view' })[0]!)
    const picker = screen.getByRole('dialog', { name: 'Pane Center' })
    expect(within(picker).getByRole('button', { name: /^Notifications/ })).toBeTruthy()
    fireEvent.click(within(picker).getByRole('button', { name: /^Notifications/ }))
    expect(Object.values(f.controller.getSnapshot().views).some(view => view.kind === 'notifications.view')).toBe(true)
  })

  it('uses one visible control layer per pane group', () => {
    const f = fixture()
    render(createElement(Regions, f))
    const right = screen.getByRole('complementary', { name: 'Right workspace' })
    expect(right.querySelector('.pwr-toolbar')).toBeNull()
    expect(within(right).getAllByRole('button', { name: 'Open workspace view' })).toHaveLength(1)
    expect(within(right).getAllByRole('button', { name: 'Maximize pane' })).toHaveLength(1)
    expect(within(right).getAllByRole('button', { name: 'Close README.md' })).toHaveLength(1)

    fireEvent.click(within(right).getByRole('button', { name: 'More actions for README.md' }))
    const menu = screen.getByRole('menu', { name: 'README.md actions' })
    expect(within(menu).getByRole('menuitem', { name: 'Customize Workspace' }).querySelector('[data-workbench-icon="workspace"]')).not.toBeNull()
    expect(within(menu).getByRole('menuitem', { name: 'Move to Bottom' }).querySelector('[data-workbench-icon="move-down"]')).not.toBeNull()
    expect(within(menu).getByRole('menuitem', { name: 'Split above' }).querySelector('[data-workbench-icon="split-up"]')).not.toBeNull()
    expect(within(menu).getAllByRole('separator')).toHaveLength(2)
  })

  it('hot-switches mounted chrome to natural Chinese copy without changing pane state', () => {
    const f = fixture()
    render(createElement(Regions, f))
    const before = f.controller.getSnapshot()

    act(() => setActiveLocale('zh'))

    const right = screen.getByRole('complementary', { name: '右侧工作区' })
    expect(within(right).getByRole('button', { name: '自定义工作区' })).toBeTruthy()
    expect(within(right).getByRole('group', { name: '工作台字号' })).toBeTruthy()
    expect(f.controller.getSnapshot().views).toEqual(before.views)
  })

  it('routes terminal close through the protected review instead of closing it on first click', () => {
    const f = fixture()
    render(createElement(Regions, f))
    const bottom = screen.getByRole('complementary', { name: 'Bottom workspace' })
    fireEvent.click(within(bottom).getByRole('button', { name: 'Close Terminal 1' }))
    expect(within(bottom).getByRole('tab', { name: 'Terminal 1' })).toBeTruthy()
    const center = screen.getByRole('dialog', { name: 'Pane Center' })
    expect(within(center).getByText('Terminal cannot be resumed')).toBeTruthy()
    fireEvent.click(within(center).getByRole('button', { name: 'Close anyway' }))
    expect(within(bottom).queryByRole('tab', { name: 'Terminal 1' })).toBeNull()
  })

  it('keeps the active view mounted when the Right dock derives to its 44px rail', () => {
    const f = fixture()
    const view = render(createElement(Regions, f))
    expect(screen.getByText('File content')).toBeTruthy()
    expect(f.getFileMounts()).toBe(1)
    view.rerender(createElement(Regions, { ...f, rightMode: 'rail' }))
    expect(f.getFileMounts()).toBe(1)
    const right = screen.getByRole('complementary', { name: 'Right workspace' })
    expect(right.getAttribute('data-mode')).toBe('rail')
  })

  it('disables keyboard split actions that would violate the 280×180 pane floor', () => {
    const f = fixture()
    render(createElement(Regions, f))
    const right = screen.getByRole('complementary', { name: 'Right workspace' })
    fireEvent.keyDown(within(right).getByRole('tab', { name: 'README.md' }), { key: 'F10', shiftKey: true })
    expect((screen.getByRole('menuitem', { name: 'Split left' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('menuitem', { name: 'Split right' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('menuitem', { name: 'Split above' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('exposes a persistent Agents rail icon only after subagent.monitor is registered', () => {
    const withoutAgents = fixture()
    const { rerender } = render(createElement(Regions, withoutAgents))
    const right = screen.getByRole('complementary', { name: 'Right workspace' })
    expect(within(right).queryByRole('button', { name: 'Agents' })).toBeNull()
    const withAgents = fixture()
    withAgents.registry.registerView({
      descriptor: {
        kind: 'subagent.monitor',
        label: 'Agents',
        componentKey: 'subagent-monitor',
        role: 'navigator',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
      },
      component: () => createElement('p', null, 'Agents body'),
    })
    rerender(createElement(Regions, withAgents))
    const nextRight = screen.getByRole('complementary', { name: 'Right workspace' })
    expect(within(nextRight).getByRole('button', { name: 'Agents' })).toBeTruthy()
    fireEvent.click(within(nextRight).getByRole('button', { name: 'Agents' }))
    expect(within(nextRight).getByRole('tab', { name: 'Agents' })).toBeTruthy()
    expect(within(nextRight).getByText('Agents body')).toBeTruthy()
  })

  it('reserves the activity rail width while the Right workspace body is open', () => {
    const f = fixture()
    render(createElement(Regions, f))
    const right = screen.getByRole('complementary', { name: 'Right workspace' })
    expect(right.querySelector('style')?.textContent).toContain(
      ".pwr-root[data-region='right'] .pwr-body{left:44px;width:calc(100% - 44px)}",
    )
  })

  it('visualizes center attachment and directional split targets without leaking locale keys', () => {
    expect(paneDropTargetLabel({ groupId: 'group:bottom', edge: 'center', enabled: true })).toBe('Move to this pane')
    expect(paneDropTargetLabel({ groupId: 'group:bottom', edge: 'top', enabled: true })).toBe('Split above')
    expect(REGION_STYLES).toContain("[data-pane-drop-edge='top']>.pwr-drop{inset:8px 8px 52%}")
    expect(REGION_STYLES).not.toContain('drag.splitUpper')
  })

  it('uses Chinese drag labels and human-readable disabled reasons', () => {
    setActiveLocale('zh')
    expect(paneDropTargetLabel({ groupId: 'group:bottom', edge: 'center', enabled: true })).toBe('移动到此窗格')
    expect(paneDropTargetLabel({ groupId: 'group:bottom', edge: 'top', enabled: true })).toBe('在上方拆分')
    expect(paneDropTargetLabel({ groupId: 'group:bottom', edge: 'center', enabled: false, reason: 'locked' })).toBe('不可放置：此窗格已锁定。')
  })

  it('accepts a dragged tab across the entire empty Bottom workspace with visible feedback', async () => {
    const f = fixture(false)
    render(createElement(Regions, f))
    const right = screen.getByRole('complementary', { name: 'Right workspace' })
    const bottom = screen.getByRole('complementary', { name: 'Bottom workspace' })
    const source = within(right).getByRole('tab', { name: 'README.md' })
    const emptyBottom = bottom.querySelector<HTMLElement>('[data-pane-empty-drop-region="bottom"]')!

    fireEvent.pointerDown(source, { clientX: 10, clientY: 10, button: 0, buttons: 1 })
    fireEvent.pointerMove(emptyBottom, { clientX: 60, clientY: 80, buttons: 1 })

    await waitFor(() => expect(within(bottom).getByRole('status', { name: 'Move to this pane' })).toBeTruthy())
    expect(source.closest('[data-pane-drag-source]')?.getAttribute('data-pane-drag-source')).toBe('true')

    fireEvent.pointerUp(emptyBottom, { clientX: 60, clientY: 80 })
    await waitFor(() => expect(within(bottom).getByRole('tab', { name: 'README.md' })).toBeTruthy())
  })

  it('exposes a Bottom activation strip while the real Bottom slot is hidden at zero height', async () => {
    const f = fixture(false)
    render(createElement(Regions, f))
    const right = screen.getByRole('complementary', { name: 'Right workspace' })
    const bottom = screen.getByRole('complementary', { name: 'Bottom workspace' })
    const source = within(right).getByRole('tab', { name: 'README.md' })

    fireEvent.pointerDown(source, { clientX: 100, clientY: 40, button: 0, buttons: 1 })
    fireEvent.pointerMove(window, { clientX: 600, clientY: window.innerHeight - 90, buttons: 1, pointerType: 'mouse' })
    const activationStrip = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[data-pane-hidden-bottom-drop="true"]')
      expect(element).not.toBeNull()
      return element!
    })
    expect(activationStrip.getAttribute('aria-label')).toBe('Keep dragging down to open the Bottom workspace')
    expect(activationStrip.getAttribute('data-pane-drop-phase')).toBe('preview')

    fireEvent.pointerMove(window, { clientX: 600, clientY: window.innerHeight - 20, buttons: 1, pointerType: 'mouse' })
    await waitFor(() => expect(activationStrip.getAttribute('data-pane-drop-phase')).toBe('ready'))
    fireEvent.pointerUp(window, { clientX: 600, clientY: window.innerHeight - 20, pointerType: 'mouse' })

    await waitFor(() => expect(within(bottom).getByRole('tab', { name: 'README.md' })).toBeTruthy())
    expect(f.controller.getSnapshot().regions.bottom.visible).toBe(true)
  })

  it('uses responsive fine and coarse pointer thresholds for hidden Bottom attachment', () => {
    expect(resolveHiddenBottomDropPhase(700, 800)).toBe('preview')
    expect(resolveHiddenBottomDropPhase(740, 800)).toBe('ready')
    expect(resolveHiddenBottomDropPhase(650, 800)).toBe('hidden')
    expect(resolveHiddenBottomDropPhase(680, 800, true)).toBe('preview')
    expect(resolveHiddenBottomDropPhase(710, 800, true)).toBe('ready')
  })

  it('does not expose the removed temporary tool-details pane', () => {
    const f = fixture()
    registerPaneWorkbenchCoreViews(f.registry)
    openPaneWorkbenchCoreView(f.controller, 'dsh.tool-details')
    expect(f.registry.get('dsh.tool-details')).toBeUndefined()
    expect(Object.values(f.controller.getSnapshot().views).some(view => view.kind === 'dsh.tool-details')).toBe(false)
  })
})
