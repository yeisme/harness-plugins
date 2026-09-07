// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaneCommandRegistry } from '../src/composition.js'
import { PaneWorkbenchController } from '../src/controller.js'
import { setActiveLocale } from '../src/i18n/locale.js'
import { createSessionListConversationSearchHost } from '../src/conversation-search-host.js'
import { WorkspaceSearchOverlay } from '../src/search-overlay.js'
import { PaneViewRegistry } from '../src/view-registry.js'

afterEach(() => {
  cleanup()
  setActiveLocale('en')
})

function fixture() {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: { kind: 'git.status', label: 'Git', componentKey: 'git', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { owner: 'git', keywords: ['source control'] } },
    component: () => createElement('p', null, 'Git body'),
  })
  registry.registerView({
    descriptor: { kind: 'legacy.compat', label: 'Legacy Compat', componentKey: 'legacy', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: true },
    component: () => null,
    showInPicker: false,
  })
  const commands = new PaneCommandRegistry()
  commands.register({
    descriptor: { id: 'git.open', label: 'Open Git', presentation: { owner: 'git', task: 'open-only', icon: 'git.status' } },
    execute: () => {},
  })
  commands.register({
    descriptor: { id: 'git.commit', label: 'Commit', permission: 'git.write', presentation: { owner: 'git', task: 'side-effect' } },
    execute: () => {},
  })
  const controller = new PaneWorkbenchController({ registry })
  controller.openView({ kind: 'git.status', resourceKey: 'view:git.status', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, title: 'Git' })
  return { registry, commands, controller }
}

describe('WorkspaceSearchOverlay', () => {
  it('groups empty-query results and opens the selected pane with Enter', async () => {
    const { registry, commands, controller } = fixture()
    const onClose = vi.fn()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose }))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    expect(within(dialog).getByRole('button', { name: 'Pin search as a pane' })).toBeTruthy()
    expect(within(dialog).getByText('Open')).toBeTruthy()
    expect(within(dialog).queryByRole('option', { name: /Legacy Compat/ })).toBeNull()
    const search = within(dialog).getByRole('combobox')
    fireEvent.keyDown(search, { key: 'Enter' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    fireEvent.change(search, { target: { value: 'Commit' } })
    expect(within(dialog).getByRole('option', { name: /Commit/ })).toBeTruthy()
    fireEvent.change(search, { target: { value: 'legacy.compat' } })
    expect(within(dialog).getByRole('option', { name: /Legacy Compat/ })).toBeTruthy()
  })

  it('keeps search context when a side-effect command is only selected', () => {
    const { registry, commands, controller } = fixture()
    const execute = vi.spyOn(commands, 'execute')
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Commit' } })
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('pins into a search pane without executing a result', () => {
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }))
    fireEvent.click(screen.getByRole('button', { name: 'Pin search as a pane' }))
    expect(Object.values(controller.getSnapshot().views).some(view => view.kind === 'dsh.workspace-search')).toBe(true)
  })

  it.each([360, 560, 960] as const)('keeps input and close visible at %spx', width => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    const { registry, commands, controller } = fixture()
    const view = render(createElement('div', { style: { width, height: 800, position: 'relative' } },
      createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() })))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    expect(within(dialog).getByRole('combobox')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Close view selector' })).toBeTruthy()
    expect(dialog.querySelector('[data-workspace-search="dialog"]')).not.toBeNull()
    expect(dialog.querySelector('style[data-workspace-search-styles]')?.textContent).toContain('.pwr-search')
    view.unmount()
  })

  it('keeps the search field and close control at 200% zoom', () => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    document.documentElement.style.zoom = '2'
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    expect(within(dialog).getByRole('combobox')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Close view selector' })).toBeTruthy()
    document.documentElement.style.zoom = ''
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
  })

  it('truncates a long bilingual title without executing HTML', () => {
    const { registry, commands, controller } = fixture()
    const longTitle = '超长中文标题需要被截断'.repeat(4) + ' / VeryLongEnglishPaneTitleWithoutBreaks'
    expect(longTitle.length).toBeLessThanOrEqual(160)
    registry.registerView({
      descriptor: {
        kind: 'docs.long-title',
        label: longTitle,
        componentKey: 'long',
        role: 'content',
        preferredRegion: 'right',
        retention: 'snapshot',
        singleton: true,
        presentation: { owner: 'docs', description: '<img src=x onerror=alert(1)>' },
      },
      component: () => null,
    })
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: '超长中文标题需要被截断' } })
    const option = within(dialog).getByRole('option', { name: longTitle })
    expect(option.querySelector('.pwr-search-copy')).not.toBeNull()
    expect(option.innerHTML).not.toContain('<img')
    expect(option.innerHTML).not.toContain('onerror')
    expect(dialog.querySelector('style[data-workspace-search-styles]')?.textContent).toContain('text-overflow:ellipsis')
  })

  it('switches Chinese copy without changing result identity', () => {
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }))
    const english = screen.getByRole('dialog', { name: 'Search and open' })
    fireEvent.change(within(english).getByRole('combobox'), { target: { value: 'Git' } })
    const englishKey = within(english).getByRole('option', { name: /Git/ }).getAttribute('data-search-option')
    act(() => { setActiveLocale('zh') })
    const chinese = screen.getByRole('dialog', { name: '搜索与打开' })
    expect(within(chinese).getByRole('option', { name: /Git/ }).getAttribute('data-search-option')).toBe(englishKey)
    expect(within(chinese).getByRole('button', { name: '窗格' })).toBeTruthy()
  })

  it('does not leak overlay chrome styles onto an adjacent pane', () => {
    const { registry, commands, controller } = fixture()
    render(createElement('div', null,
      createElement('aside', {
        'data-neighbor-pane': true,
        style: { color: 'rgb(1, 2, 3)', backgroundColor: 'rgb(4, 5, 6)', fontSize: '19px' },
      }, 'Neighbor pane'),
      createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }),
    ))
    const neighbor = document.querySelector('[data-neighbor-pane]')
    expect(neighbor).not.toBeNull()
    const styles = getComputedStyle(neighbor as HTMLElement)
    expect(styles.color).toBe('rgb(1, 2, 3)')
    expect(styles.backgroundColor).toBe('rgb(4, 5, 6)')
    expect(styles.fontSize).toBe('19px')
    expect(neighbor?.closest('.pwr-search')).toBeNull()
  })

  it('records history as unavailable on the adapter contract instead of a live query', () => {
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    expect(within(dialog).getAllByText('History search is unavailable in this host.').length).toBeGreaterThan(0)
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Git' } })
    expect(within(dialog).getByRole('option', { name: /Git/ })).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  it('queries the current-profile conversation owner, paginates, and opens a hit', async () => {
    const { registry, commands, controller } = fixture()
    const open = vi.fn()
    const byId: Record<string, { displayTitle: string }> = {}
    for (let index = 0; index < 25; index += 1) byId[`session:${index}`] = { displayTitle: `Planning ${index}` }
    const conversationSearch = createSessionListConversationSearchHost({
      list: { getSnapshot: () => ({ ids: Object.keys(byId), byId, current: 'session:0' }) },
      open,
    })
    expect(conversationSearch).toBeDefined()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, conversationSearch, onClose: vi.fn() }))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    expect(within(dialog).queryByText('History search is unavailable in this host.')).toBeNull()
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Planning' } })
    await waitFor(() => expect(within(dialog).getByRole('option', { name: /Planning 0/ })).toBeTruthy())
    expect(within(dialog).getByRole('button', { name: 'Load more' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Load more' })).toBeNull())
    fireEvent.click(within(dialog).getByRole('option', { name: /Planning 0/ }))
    await waitFor(() => expect(open).toHaveBeenCalledWith('session:0'))
  })
})
