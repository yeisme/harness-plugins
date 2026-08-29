// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { setActiveLocale } from '../src/i18n/locale.js'
import {
  dispatchOverlayBulkClose,
  OfficialOverlayPaneHost,
  OVERLAY_SHEET_BREAKPOINT_PX,
  projectOverlayTabList,
} from '../src/official-host.js'
import { PaneViewRegistry } from '../src/view-registry.js'

afterEach(() => {
  cleanup()
  setActiveLocale('en')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
})

function setViewport(width: number, height = 800): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

function createOverlayFixture(input: { readonly denyBottomClose?: boolean } = {}): {
  readonly registry: PaneViewRegistry
  readonly controller: PaneWorkbenchController
} {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: { kind: 'test.content', label: 'Content', componentKey: 'content', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false },
    component: () => createElement('p', null, 'Content body'),
  })
  registry.registerView({
    descriptor: { kind: 'test.utility', label: 'Utility', componentKey: 'utility', role: 'utility', preferredRegion: 'bottom', retention: 'snapshot', singleton: false },
    component: () => createElement('p', null, 'Utility body'),
  })
  const controller = new PaneWorkbenchController({ registry })
  controller.openView({ kind: 'test.content', resourceKey: 'test:content', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, pinned: true, title: 'Content' })
  controller.openView({
    kind: 'test.utility',
    resourceKey: 'test:utility',
    role: 'utility',
    preferredRegion: 'bottom',
    retention: 'snapshot',
    singleton: false,
    title: 'Utility',
    ...(input.denyBottomClose === true ? { closePolicy: 'deny' as const } : {}),
  })
  return { registry, controller }
}

describe('OfficialOverlayPaneHost', () => {
  it('reuses the canonical rail and tab chrome instead of a second drawer UI', () => {
    setActiveLocale('zh')
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registry.registerView({
      descriptor: { kind: 'conversation.tools', label: '工具', componentKey: 'tools', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true },
      component: () => createElement('p', null, 'Tools body'),
    })
    const controller = new PaneWorkbenchController({ registry })
    controller.openView({ kind: 'conversation.tools', resourceKey: 'conversation:tools', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, pinned: true, title: '工具' })

    render(createElement(OfficialOverlayPaneHost, { registry, controller }))
    const host = screen.getByRole('complementary', { name: '工作台侧栏' })
    expect(host.getAttribute('data-pane-overlay-chrome')).toBe('unified')
    expect(within(host).getByRole('tab', { name: '工具' })).toBeTruthy()
    expect(within(host).getByText('Tools body')).toBeTruthy()
    expect(host.querySelector('.pwr-rail')).not.toBeNull()

    fireEvent.click(within(host).getByRole('button', { name: '关闭工作台' }))
    expect(screen.queryByRole('complementary', { name: '工作台侧栏' })).toBeNull()
  })

  it.each([
    [1440, false],
    [1024, false],
    [768, false],
    [390, true],
  ] as const)('collapses both canonical regions into one tablist at %ipx (sheet=%s)', (width, sheet) => {
    setViewport(width)
    const { registry, controller } = createOverlayFixture()
    const before = JSON.stringify(controller.getSnapshot())

    render(createElement(OfficialOverlayPaneHost, { registry, controller }))
    const host = screen.getByRole('complementary', { name: 'Workbench side panel' })
    expect(host.classList.contains('pwr-root')).toBe(true)
    expect(host.getAttribute('data-pane-overlay-sheet')).toBe(sheet ? 'true' : null)
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    expect(within(host).getByRole('tab', { name: 'Content' })).toBeTruthy()
    expect(within(host).getByRole('tab', { name: 'Utility' })).toBeTruthy()
    const maximize = within(host).getByRole('button', { name: 'Maximize pane' }) as HTMLButtonElement
    expect(maximize.disabled).toBe(true)
    expect(maximize.getAttribute('data-pane-gated-intent')).toBe('maximize_group')
    expect(JSON.stringify(controller.getSnapshot())).toBe(before)

    const css = host.querySelector('style')?.textContent ?? ''
    expect(css).toContain(`@media(max-width:${OVERLAY_SHEET_BREAKPOINT_PX}px)`)
    expect(css).toContain('min-width:44px;min-height:44px')
    expect(css).toContain('@media(prefers-reduced-motion:reduce)')
    expect(css).toContain('.pwr-menu .pwr-menu-item')
  })

  it('opens the Pane Center and More menu through keyboard-equivalent paths', () => {
    const { registry, controller } = createOverlayFixture()
    render(createElement(OfficialOverlayPaneHost, { registry, controller }))
    const host = screen.getByRole('complementary', { name: 'Workbench side panel' })
    const openView = within(host).getByRole('button', { name: 'Open workspace view' })

    fireEvent.click(openView)
    const picker = screen.getByRole('dialog', { name: 'Pane Center' })
    expect(picker).toBeTruthy()
    fireEvent.keyDown(picker, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Pane Center' })).toBeNull()
    expect(document.activeElement).toBe(openView)

    const activeTab = within(host).getByRole('tab', { name: 'Utility' })
    fireEvent.keyDown(activeTab, { key: 'F10', shiftKey: true })
    const menu = within(host).getByRole('menu', { name: 'Utility actions' })
    const moveRight = within(menu).getByRole('menuitem', { name: 'Move to Right' }) as HTMLButtonElement
    const splitRight = within(menu).getByRole('menuitem', { name: 'Split right' }) as HTMLButtonElement
    expect(moveRight.disabled).toBe(true)
    expect(splitRight.disabled).toBe(true)
    expect(moveRight.title).toContain('host workspace seam')
    expect(moveRight.querySelector('[data-workbench-icon="move-right"]')).not.toBeNull()
    expect(splitRight.querySelector('[data-workbench-icon="split-right"]')).not.toBeNull()
  })

  it('preflights every real group before committing a collapsed bulk close', () => {
    const { controller } = createOverlayFixture({ denyBottomClose: true })
    const state = controller.getSnapshot()
    const projection = projectOverlayTabList(state)
    const content = Object.values(state.views).find(view => view.kind === 'test.content')
    expect(projection.groupOrder).toEqual(['group:right:content', 'group:bottom:utility'])

    const result = dispatchOverlayBulkClose(controller, 'others', content?.id)
    expect(result).toMatchObject({ accepted: false, reason: 'close_denied' })
    expect(Object.keys(controller.getSnapshot().views)).toEqual(Object.keys(state.views))
  })
})
