// @vitest-environment jsdom
import { createElement, useEffect } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { PaneRegionChrome } from '../src/region-chrome.js'
import { PaneViewRegistry } from '../src/view-registry.js'

afterEach(cleanup)

function fixture() {
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
  controller.openView({ kind: 'terminal.session', resourceKey: 'terminal:one', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: false, pinned: true, title: 'Terminal 1' })
  return { registry, controller, getFileMounts: () => fileMounts }
}

function Regions(props: ReturnType<typeof fixture> & { rightMode?: 'rail' | 'dock' }) {
  return createElement('div', null,
    createElement(PaneRegionChrome, { region: 'right', mode: props.rightMode ?? 'dock', width: props.rightMode === 'rail' ? 44 : 480, height: 800, visible: true, maximized: false, registry: props.registry, controller: props.controller }),
    createElement(PaneRegionChrome, { region: 'bottom', mode: 'dock', width: 900, height: 280, visible: true, maximized: false, registry: props.registry, controller: props.controller }),
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
    const picker = screen.getByRole('dialog', { name: 'Open workspace view' })
    expect(within(picker).getByRole('button', { name: /Notifications/ })).toBeTruthy()
    fireEvent.click(within(picker).getByRole('button', { name: /Notifications/ }))
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
    expect(screen.getByRole('menuitem', { name: 'Hide Right workspace' })).toBeTruthy()
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
    expect((screen.getByRole('menuitem', { name: 'Split top' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('reserves the activity rail width while the Right workspace body is open', () => {
    const f = fixture()
    render(createElement(Regions, f))
    const right = screen.getByRole('complementary', { name: 'Right workspace' })
    expect(right.querySelector('style')?.textContent).toContain(
      ".pwr-root[data-region='right'] .pwr-body{left:44px;width:calc(100% - 44px)}",
    )
  })
})
