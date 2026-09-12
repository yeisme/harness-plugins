// @vitest-environment jsdom
import { createElement, StrictMode, useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaneCommandRegistry } from '../src/composition.js'
import { PaneWorkbenchController } from '../src/controller.js'
import { setActiveLocale } from '../src/i18n/locale.js'
import { createSessionListConversationSearchHost } from '../src/conversation-search-host.js'
import { SearchResultAnnouncement } from '../src/search-announcement.js'
import { WorkspaceSearchOverlay } from '../src/search-overlay.js'
import { searchSourcesFor } from '../src/search-source-registry.js'
import { DSH_WORKSPACE_SEARCH_VIEW_KIND, DSH_WORKSPACE_SEARCH_RESOURCE_KEY } from '../src/core-pane.js'
import { sourceSearchCenterResult } from '../src/search-source.js'
import { continueInSearchPane, searchHandoffChannel } from '../src/search-handoff.js'
import { DEFAULT_WORKSPACE_SEARCH_FILTERS } from '../src/search-group.js'
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

describe('SearchResultAnnouncement', () => {
  it('coalesces owner updates, suppresses IME and announces loss without exposing content or claiming a total', () => {
    vi.useFakeTimers()
    try {
      const base = { contextKey: 'private query', keys: ['opaque:a'], selectedKey: 'opaque:a', busy: false, composing: false, enabled: true }
      const view = render(createElement(SearchResultAnnouncement, base))
      const live = screen.getByRole('status')
      expect(live.getAttribute('aria-live')).toBe('polite')
      act(() => vi.advanceTimersByTime(300))
      view.rerender(createElement(SearchResultAnnouncement, { ...base, keys: ['opaque:a', 'opaque:b'] }))
      act(() => vi.advanceTimersByTime(300))
      expect(live.textContent).toBe('')
      act(() => vi.advanceTimersByTime(200))
      expect(live.textContent).toContain('2 results currently shown')
      expect(live.textContent).not.toMatch(/private|opaque/)
      view.rerender(createElement(SearchResultAnnouncement, { ...base, keys: ['opaque:b'], selectedKey: 'opaque:b' }))
      act(() => vi.advanceTimersByTime(500))
      expect(live.textContent).toContain('previously selected result is no longer shown')
      view.rerender(createElement(SearchResultAnnouncement, { ...base, composing: true }))
      act(() => vi.advanceTimersByTime(1000))
      expect(live.textContent).toBe('')
      view.rerender(createElement(SearchResultAnnouncement, { ...base, contextKey: 'next query', keys: [], selectedKey: undefined, busy: true }))
      act(() => vi.advanceTimersByTime(500))
      expect(live.textContent).toBe('Search results are updating.')
      view.unmount()
      expect(vi.getTimerCount()).toBe(0)
    } finally { vi.useRealTimers() }
  })
})

describe('WorkspaceSearchOverlay', () => {
  it('cancels an uncooperative source open when the query changes and admits a new action', async () => {
    const { registry, commands, controller } = fixture()
    const close = vi.fn(), signals: AbortSignal[] = []
    let finish!: (value: { status: 'opened' }) => void
    const search = vi.fn(async () => ({ status: 'ready' as const, resources: [{ owner: 'fixture', ref: 'folder', kind: 'folder' as const, title: 'Planning folder' }] }))
    const open = vi.fn((_resource: unknown, _scope: unknown, signal?: AbortSignal) => {
      signals.push(signal!)
      return signals.length === 1 ? new Promise<{ status: 'opened' }>(resolve => { finish = resolve }) : Promise.resolve({ status: 'opened' as const })
    })
    searchSourcesFor(controller).register({ cancellableOpen: true, descriptor: { id: 'cancel.folder', owner: 'fixture', resourceKinds: ['folder'], scopes: ['profile'], coverage: 'metadata', filters: [], sorts: ['relevance'], pagination: false, preview: false, open: true }, search, open })
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'dialog', onClose: close }))
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Planning' } })
    fireEvent.click(await within(screen.getByRole('listbox')).findByRole('option', { name: 'Planning folder' }))
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    fireEvent.change(input, { target: { value: 'Next' } })
    await waitFor(() => expect(signals[0]!.aborted).toBe(true))
    expect(close).not.toHaveBeenCalled()
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
    fireEvent.click(await within(screen.getByRole('listbox')).findByRole('option', { name: 'Planning folder' }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    await act(async () => finish({ status: 'opened' }))
    expect(close).toHaveBeenCalledOnce()
  })

  it('bounds only the search surface to a changing visual viewport and releases its listeners', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const viewport = Object.assign(new EventTarget(), { width: 360, height: 300, offsetTop: 40, offsetLeft: 0 })
    const add = vi.spyOn(viewport, 'addEventListener'), remove = vi.spyOn(viewport, 'removeEventListener')
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    try {
      const { registry, commands, controller } = fixture()
      const view = render(createElement(StrictMode, null, createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' })))
      const surface = view.container.querySelector<HTMLElement>('[data-workspace-search]')!
      expect(surface.getAttribute('data-search-visual-viewport')).toBe('pane')
      expect(surface.style.getPropertyValue('--pwr-search-vv-height')).toBe('328px')
      expect(surface.style.getPropertyValue('--pwr-search-vv-inset-top')).toBe('40px')
      expect(document.body.style.getPropertyValue('--pwr-search-vv-height')).toBe('')
      surface.scrollTop = 120
      act(() => { viewport.height = window.innerHeight; viewport.width = window.innerWidth; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('resize')) })
      await waitFor(() => expect(surface.hasAttribute('data-search-visual-viewport')).toBe(false))
      expect(surface.style.getPropertyValue('--pwr-search-vv-height')).toBe('')
      expect(surface.scrollTop).toBe(0)
      view.unmount()
      expect(remove.mock.calls).toHaveLength(add.mock.calls.length)
    } finally {
      if (original) Object.defineProperty(window, 'visualViewport', original)
      else Reflect.deleteProperty(window, 'visualViewport')
    }
  })

  it('selects explicit session scope, preserves it on clear and denies a removed session without widening', async () => {
    const { registry, commands, controller } = fixture()
    let snapshot = { ids: ['a', 'b'], byId: { a: { displayTitle: 'Session A' }, b: { displayTitle: 'Session B' } } }
    const listeners = new Set<() => void>()
    const conversationSearch = createSessionListConversationSearchHost({ list: {
      getSnapshot: () => snapshot,
      subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    } })
    const search = vi.fn(async (_request: unknown) => ({ status: 'ready' as const, resources: [{ owner: 'fixture', ref: 'read', sessionRef: 'a', kind: 'native-tool' as const, title: 'Read in A' }] }))
    searchSourcesFor(controller).register({ descriptor: { id: 'fixture.session', owner: 'fixture', resourceKinds: ['native-tool'], scopes: ['session'], coverage: 'catalog', filters: [], sorts: ['relevance'], pagination: false, preview: false, open: false }, search })
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, conversationSearch, mode: 'pane' }))
    const scope = screen.getByRole('combobox', { name: 'Search scope' }) as HTMLSelectElement
    fireEvent.change(scope, { target: { value: 'session:a' } })
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Session' } })
    await within(screen.getByRole('listbox')).findByRole('option', { name: 'Session A' })
    expect(within(screen.getByRole('listbox')).queryByRole('option', { name: 'Session B' })).toBeNull()
    fireEvent.change(input, { target: { value: 'Read' } })
    await within(screen.getByRole('listbox')).findByRole('option', { name: 'Read in A' })
    expect(search.mock.calls[0]?.[0]).toMatchObject({ scope: { kind: 'session', ref: 'a' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(scope.value).toBe('session:a')
    act(() => { snapshot = { ...snapshot, ids: ['b'] }; for (const listener of listeners) listener() })
    expect(scope.value).toBe('session:a')
    expect(scope.selectedOptions[0]?.disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'Read' } })
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Read in A' })).toBeNull())
    expect(search.mock.calls.every(call => (call[0] as { scope: { ref: string } }).scope.ref === 'a')).toBe(true)
  })

  it('survives StrictMode effect replay and releases source and owner subscriptions on unmount', async () => {
    const { registry, commands, controller } = fixture()
    const ownerListeners = new Set<() => void>()
    const conversationSearch = createSessionListConversationSearchHost({ list: {
      getSnapshot: () => ({ byId: { s1: { displayTitle: 'Planning history' } } }),
      subscribe: listener => { ownerListeners.add(listener); return () => { ownerListeners.delete(listener) } },
    } })
    const sources = searchSourcesFor(controller)
    let sourceSubscriptions = 0
    const subscribe = sources.subscribe.bind(sources)
    vi.spyOn(sources, 'subscribe').mockImplementation(listener => {
      sourceSubscriptions += 1
      const unsubscribe = subscribe(listener)
      return () => { sourceSubscriptions -= 1; unsubscribe() }
    })
    const signals: AbortSignal[] = []
    let finish!: (value: { status: 'ready'; resources: { owner: string; ref: string; kind: 'skill'; title: string }[] }) => void
    sources.register({ descriptor: { id: 'replay.skills', owner: 'fixture', resourceKinds: ['skill'], coverage: 'catalog', scopes: ['profile'], filters: [], sorts: ['relevance'], pagination: false, preview: false, open: false },
      search: (_request, signal) => { signals.push(signal); return new Promise(resolve => { finish = resolve }) } })
    const view = render(createElement(StrictMode, null, createElement(WorkspaceSearchOverlay, { registry, commands, controller, conversationSearch, mode: 'pane' })))
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Planning' } })
    await within(screen.getByRole('listbox')).findByRole('option', { name: 'Planning history' })
    await waitFor(() => expect(signals).toHaveLength(1))
    expect(ownerListeners.size).toBe(2) // Metadata query and visible session scope roster.
    expect(sourceSubscriptions).toBe(2) // Descriptor subscription plus coordinator connection.
    await act(async () => { finish({ status: 'ready', resources: [{ owner: 'fixture', ref: 'plan', kind: 'skill', title: 'Planning skill' }] }) })
    await within(screen.getByRole('listbox')).findByRole('option', { name: 'Planning skill' })
    fireEvent.change(input, { target: { value: 'Next request' } })
    await waitFor(() => expect(signals).toHaveLength(2))
    view.unmount()
    expect(signals[1]!.aborted).toBe(true)
    expect(ownerListeners.size).toBe(0)
    expect(sourceSubscriptions).toBe(0)
    await act(async () => { finish({ status: 'ready', resources: [{ owner: 'fixture', ref: 'late', kind: 'skill', title: 'Late resource' }] }) })
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('opens official result actions from the keyboard, skips disabled items and restores only local focus', async () => {
    const { registry, commands, controller } = fixture()
    const ancestor = vi.fn(), close = vi.fn(), execute = vi.spyOn(commands, 'execute')
    render(createElement('div', { onKeyDown: ancestor },
      createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane', onClose: close }),
      createElement('button', null, 'Neighbour pane')))
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Git' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Resource category' }), { target: { value: 'pane' } })
    const option = await screen.findByRole('option', { name: 'Git' })
    option.closest<HTMLElement>('.pwr-search-row')!.scrollIntoView = vi.fn()
    expect(within(option).queryByRole('button')).toBeNull()
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(ancestor).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'F10', shiftKey: true })
    const first = await screen.findByRole('menuitem', { name: 'Open to the right' })
    await waitFor(() => expect(document.activeElement).toBe(first))
    fireEvent.keyDown(first, { key: 'End' })
    const last = screen.getByRole('menuitem', { name: 'Open below' })
    expect(document.activeElement).toBe(last)
    expect((screen.getByRole('menuitem', { name: 'Open floating' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(last, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(input)
    expect(close).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
    expect(ancestor).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Actions for selected result' }))
    await screen.findByRole('menu')
    const neighbour = screen.getByRole('button', { name: 'Neighbour pane' })
    neighbour.focus()
    fireEvent.pointerDown(neighbour)
    fireEvent.click(neighbour)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(neighbour)
  })

  it('does not activate a local substitute while restoring a delayed source selection', async () => {
    const { registry, commands, controller } = fixture()
    const descriptor = { id: 'fixture.handoff', owner: 'fixture', resourceKinds: ['skill' as const], coverage: 'catalog' as const, scopes: ['profile' as const], filters: [], sorts: ['relevance' as const], pagination: false, preview: false, open: true }
    const resource = { owner: 'fixture', ref: 'wanted', kind: 'skill' as const, title: 'Git review' }
    let resolve!: (page: { status: 'ready'; resources: typeof resource[] }) => void
    const open = vi.fn(async () => ({ status: 'opened' as const }))
    searchSourcesFor(controller).register({ descriptor, search: () => new Promise(done => { resolve = done }), open })
    searchHandoffChannel(controller).send({ query: 'git', category: 'all', filters: DEFAULT_WORKSPACE_SEARCH_FILTERS, controls: { sort: 'relevance' }, previewLimit: 5, selectedKey: sourceSearchCenterResult(descriptor, resource).stableKey })
    const dispatch = vi.spyOn(controller, 'dispatch')
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' }))
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    await screen.findByText('The previous selection is not available yet. Wait for its source or choose another result.')
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false)
    expect(dispatch).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    await waitFor(() => expect(resolve).toBeTypeOf('function'))
    await act(async () => { resolve({ status: 'ready', resources: [resource] }) })
    await within(screen.getByRole('listbox')).findByRole('option', { name: 'Git review' })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('renders registered resources as their own category, expands five rows, previews metadata and opens the original owner', async () => {
    const { registry, commands, controller } = fixture()
    const open = vi.fn(async () => ({ status: 'opened' as const }))
    const remove = searchSourcesFor(controller).register({ descriptor: { id: 'skills.fixture', owner: 'dsh.skills', resourceKinds: ['skill'], coverage: 'catalog', scopes: ['profile'], filters: [], sorts: ['relevance'], pagination: false, preview: false, open: true },
      search: async () => ({ status: 'ready', resources: Array.from({ length: 7 }, (_, index) => ({ owner: 'dsh.skills', ref: `skill:${index}`, revision: 'v1', kind: 'skill', title: `Review skill ${index}` })) }), open })
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' }))
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Review skill' } })
    const list = within(screen.getByRole('listbox'))
    await list.findByRole('option', { name: 'Review skill 0' })
    expect(list.getAllByRole('option')).toHaveLength(5)
    fireEvent.click(list.getByRole('button', { name: 'View all' }))
    await waitFor(() => expect(list.getAllByRole('option')).toHaveLength(7))
    fireEvent.click(screen.getByRole('button', { name: 'Preview selected result' }))
    const preview = within(screen.getByRole('complementary'))
    expect(preview.getByRole('heading', { name: 'Review skill 0' })).toBeTruthy()
    expect(preview.getByText('v1')).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(preview.getByRole('button', { name: 'Open with source owner' }))
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.objectContaining({ ref: 'skill:0', revision: 'v1' }), { kind: 'profile' }))
    act(() => remove())
    expect(preview.queryByRole('heading', { name: 'Review skill 0' })).toBeNull()
  })

  it('ignores a late command completion after the dialog has been closed', async () => {
    const { registry, commands, controller } = fixture()
    let complete!: () => void
    const execute = vi.fn(() => new Promise<void>(resolve => { complete = resolve }))
    commands.register({ descriptor: { id: 'command.late', label: 'Late command' }, execute })
    const close = vi.fn(), restoreFocus = vi.fn(), setItem = vi.fn()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: close, restoreFocus, storage: { getItem: () => null, setItem, removeItem: () => {} } }))
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Late command' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(restoreFocus).toHaveBeenCalledTimes(1)
    await act(async () => { complete() })
    expect(close).toHaveBeenCalledTimes(1)
    expect(restoreFocus).toHaveBeenCalledTimes(1)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('keeps an edited query open when an earlier owner action completes', async () => {
    const { registry, commands, controller } = fixture()
    let complete!: () => void
    const execute = vi.fn(() => new Promise<void>(resolve => { complete = resolve }))
    commands.register({ descriptor: { id: 'command.pending-query', label: 'Pending action' }, execute })
    const close = vi.fn(), restoreFocus = vi.fn(), setItem = vi.fn()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: close, restoreFocus,
      storage: { getItem: () => null, setItem, removeItem: () => {} } }))
    const input = screen.getByRole('combobox', { name: /Search sessions/ }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Pending action' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    fireEvent.change(input, { target: { value: 'Git' } })
    await act(async () => { complete() })
    expect(input.value).toBe('Git')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(close).not.toHaveBeenCalled()
    expect(restoreFocus).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
  })

  it('admits one command at a time and keeps an unconfirmed receipt out of recent successes', async () => {
    const { registry, commands, controller } = fixture()
    let complete!: (value: { status: 'approval_required'; receiptRef: string }) => void
    const execute = vi.fn(() => new Promise(resolve => { complete = resolve }))
    commands.register({ descriptor: { id: 'command.wait', label: 'Wait command', presentation: { task: 'side-effect' } }, execute })
    const setItem = vi.fn()
    const close = vi.fn()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: close, storage: { getItem: () => null, setItem, removeItem: () => {} } }))
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Wait command' } })
    await within(screen.getByRole('listbox')).findByRole('option', { name: 'Wait command' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    await act(async () => { complete({ status: 'approval_required', receiptRef: 'receipt:search:pending' }) })
    expect(close).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(screen.getByText('The command owner has not confirmed completion. Check its status in the original tool before running it again.')).toBeTruthy()
  })

  it('clears a removed session from results and preview on an owner event, and releases the subscription', async () => {
    const { registry, commands, controller } = fixture()
    let byId: Record<string, { displayTitle: string }> = { s1: { displayTitle: 'Planning private' } }
    const listeners = new Set<() => void>()
    const conversationSearch = createSessionListConversationSearchHost({ list: {
      getSnapshot: () => ({ byId }),
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    } })
    const mounted = render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, conversationSearch, mode: 'pane' }))
    fireEvent.change(screen.getByRole('combobox', { name: /Search sessions/ }), { target: { value: 'Planning' } })
    await within(screen.getByRole('listbox')).findByRole('option', { name: 'Planning private' })
    fireEvent.click(screen.getByRole('button', { name: 'Preview selected result' }))
    expect(within(screen.getByRole('complementary')).getByRole('heading', { name: 'Planning private' })).toBeTruthy()
    expect(listeners.size).toBe(2) // Query and scope roster subscriptions.
    act(() => { byId = {}; for (const listener of listeners) listener() })
    expect(within(screen.getByRole('complementary')).queryByRole('heading', { name: 'Planning private' })).toBeNull()
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Back to results' }))
    await waitFor(() => expect(within(screen.getByRole('listbox')).queryByRole('option', { name: 'Planning private' })).toBeNull())
    mounted.unmount()
    expect(listeners.size).toBe(0)
  })

  it('continues into an existing singleton pane with conditions, selection and focus', async () => {
    const { registry, commands, controller } = fixture()
    registry.registerView({ descriptor: { kind: DSH_WORKSPACE_SEARCH_VIEW_KIND, label: 'Search', componentKey: 'search', role: 'utility', preferredRegion: 'right', retention: 'recreate', singleton: true }, component: () => null })
    const restoreFocus = vi.fn()
    const workspaceContext = { getSnapshot: () => ({ workspaceRef: 'w1', revision: '1' }), listWorkspaces: () => ['w1', 'w2'].map(workspaceRef => ({ workspaceRef, label: workspaceRef })) }
    function Pair() {
      const [open, setOpen] = useState(true)
      return createElement('div', null,
        createElement('div', { 'data-testid': 'destination' }, createElement(WorkspaceSearchOverlay, { registry, commands, controller, workspaceContext, mode: 'pane' })),
        open ? createElement(WorkspaceSearchOverlay, { registry, commands, controller, workspaceContext, onClose: () => setOpen(false), restoreFocus }) : null)
    }
    render(createElement(Pair))
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Git' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Search scope' }), { target: { value: 'workspace:w2' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Resource category' }), { target: { value: 'pane' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Sort within each group' }), { target: { value: 'name' } })
    await within(dialog).findByRole('option', { name: 'Git' })
    fireEvent.click(within(dialog).getByRole('button', { name: /Pin|search pane/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const destination = within(screen.getByTestId('destination'))
    const targetInput = destination.getByRole('combobox', { name: /Search sessions/ }) as HTMLInputElement
    await waitFor(() => expect(document.activeElement).toBe(targetInput))
    expect(targetInput.value).toBe('Git')
    expect((destination.getByRole('combobox', { name: 'Search scope' }) as HTMLSelectElement).value).toBe('workspace:w2')
    expect((destination.getByRole('combobox', { name: 'Resource category' }) as HTMLSelectElement).value).toBe('pane')
    expect((destination.getByRole('combobox', { name: 'Sort within each group' }) as HTMLSelectElement).value).toBe('name')
    expect(destination.getByRole('option', { name: 'Git' }).getAttribute('aria-selected')).toBe('true')
    expect(restoreFocus).not.toHaveBeenCalled()
    act(() => { continueInSearchPane(controller, registry, { query: 'Commit', category: 'command', filters: { ...DEFAULT_WORKSPACE_SEARCH_FILTERS, category: 'command' }, controls: { sort: 'relevance' }, previewLimit: 50 }) })
    await waitFor(() => expect(targetInput.value).toBe('Commit'))
    expect(Object.values(controller.getSnapshot().views).filter(view => view.kind === DSH_WORKSPACE_SEARCH_VIEW_KIND && view.resourceKey === DSH_WORKSPACE_SEARCH_RESOURCE_KEY)).toHaveLength(1)
  })

  it('previews metadata without mounting the resource and restores the query on return', async () => {
    const { registry, commands, controller } = fixture()
    const execute = vi.fn()
    commands.register({ descriptor: { id: 'danger.preview', label: 'Preview command', presentation: { owner: 'fixture', task: 'side-effect' } }, execute })
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' }))
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Preview command' } })
    await screen.findByRole('option', { name: 'Preview command' })
    fireEvent.click(screen.getByRole('button', { name: 'Preview selected result' }))
    const preview = screen.getByRole('complementary', { name: 'Read-only preview' })
    expect(within(preview).getByRole('heading', { name: 'Preview command' })).toBe(document.activeElement)
    expect(within(preview).queryByRole('button', { name: 'Open with source owner' })).toBeNull()
    expect(execute).not.toHaveBeenCalled()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('complementary', { name: 'Read-only preview' })).toBeNull()
    expect(document.activeElement).toBe(input)
    expect((input as HTMLInputElement).value).toBe('Preview command')
  })

  it('removes preview metadata when its result disappears from the current query', async () => {
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' }))
    const input = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(input, { target: { value: 'Git' } })
    await screen.findByRole('option', { name: 'Git' })
    fireEvent.click(screen.getByRole('button', { name: 'Preview selected result' }))
    expect(screen.queryByText('Git body')).toBeNull()
    fireEvent.change(input, { target: { value: 'unmatched resource' } })
    await waitFor(() => expect(within(screen.getByRole('complementary')).getByRole('status').textContent).toContain('no longer'))
    expect(within(screen.getByRole('complementary')).queryByRole('button', { name: 'Open with source owner' })).toBeNull()
  })

  it('keeps a manually selected scope when another pane changes the active project context', () => {
    const { registry, commands, controller } = fixture()
    let workspaceRef = 'w1'
    let revision = '1'
    const listeners = new Set<() => void>()
    const workspaceContext = {
      getSnapshot: () => ({ workspaceRef, revision }),
      listWorkspaces: () => ['w1', 'w2', 'w3'].map(ref => ({ workspaceRef: ref, label: ref })),
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    }
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, workspaceContext, mode: 'pane' }))
    const scope = screen.getByRole('combobox', { name: 'Search scope' }) as HTMLSelectElement
    expect(scope.value).toBe('workspace:w1')
    fireEvent.change(scope, { target: { value: 'workspace:w3' } })
    act(() => { workspaceRef = 'w2'; revision = '2'; for (const listener of listeners) listener() })
    expect(scope.value).toBe('workspace:w3')
  })

  it('describes the selected workspace source instead of a metadata fallback that is not being queried', () => {
    const { registry, commands, controller } = fixture()
    const conversationSearch = createSessionListConversationSearchHost({ list: { getSnapshot: () => ({ byId: {} }) } })!
    const workspaceContext = { getSnapshot: () => ({ workspaceRef: 'w1', revision: '1' }), search: vi.fn(async () => ({ items: [], status: 'ready' as const })) }
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, conversationSearch, workspaceContext, mode: 'pane' }))
    expect(screen.getByText('Source coverage not declared')).toBeTruthy()
    expect(screen.queryByText('Session titles and IDs only')).toBeNull()
    expect((screen.getByLabelText('Updated since (UTC)') as HTMLInputElement).disabled).toBe(true)
  })

  it('preserves an applicable source and status when narrowing from all resources to panes', () => {
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' }))
    const statusValue = Object.values(controller.getSnapshot().views)[0]!.status
    const status = screen.getByRole('combobox', { name: 'Resource status' }) as HTMLSelectElement
    const source = screen.getByRole('combobox', { name: 'Source' }) as HTMLSelectElement
    fireEvent.change(status, { target: { value: statusValue } })
    fireEvent.change(source, { target: { value: 'git' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Resource category' }), { target: { value: 'pane' } })
    expect(status.value).toBe(statusValue)
    expect(source.value).toBe('git')
    expect(within(screen.getByRole('listbox', { name: 'Search results' })).getByRole('option', { name: 'Git' })).toBeTruthy()
  })

  it('keeps an explicit project scope on clear and refuses a revoked selected project', async () => {
    const { registry, commands, controller } = fixture()
    let revision = '1'
    let projects = ['w1', 'w2']
    const listeners = new Set<() => void>()
    const searchOwner = vi.fn(async (request: { workspaceRefs: readonly string[] }) => ({
      items: [{ workspaceRef: request.workspaceRefs[0]!, ref: 'session:selected', source: 'history' as const, kind: 'session', title: `Planning ${request.workspaceRefs[0]}` }], status: 'ready' as const,
    }))
    const workspaceContext = {
      getSnapshot: () => ({ workspaceRef: 'w1', revision }),
      listWorkspaces: () => projects.map(workspaceRef => ({ workspaceRef, label: workspaceRef })),
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
      search: searchOwner,
    }
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, workspaceContext, mode: 'pane' }))
    const scope = screen.getByRole('combobox', { name: 'Search scope' }) as HTMLSelectElement
    expect(scope.value).toBe('workspace:w1')
    const search = screen.getByRole('combobox', { name: /Search sessions/ })
    const results = within(screen.getByRole('listbox', { name: 'Search results' }))
    fireEvent.change(search, { target: { value: 'Planning' } })
    await waitFor(() => expect(results.getByRole('option', { name: 'Planning w1' })).toBeTruthy())
    fireEvent.change(scope, { target: { value: 'workspace:w2' } })
    await waitFor(() => expect(results.getByRole('option', { name: 'Planning w2' })).toBeTruthy())
    fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), { target: { value: 'git' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(scope.value).toBe('workspace:w2')
    act(() => { projects = ['w1']; revision = '2'; for (const listener of listeners) listener() })
    expect(scope.value).toBe('workspace:w2')
    await waitFor(() => expect(results.queryByRole('option', { name: 'Planning w2' })).toBeNull())
    expect(screen.getAllByText('Selected project is unavailable').length).toBeGreaterThan(0)
  })

  it('applies time filtering before the first history page and keeps scope when changing categories', async () => {
    const { registry, commands, controller } = fixture()
    const byId: Record<string, { displayTitle: string; updatedAt: string; running: boolean }> = {}
    for (let index = 0; index < 25; index++) byId[`s${index}`] = { displayTitle: `Planning old ${index}`, updatedAt: '2025-01-01T00:00:00Z', running: false }
    byId.newest = { displayTitle: 'Planning newest', updatedAt: '2026-09-10T00:00:00Z', running: true }
    const conversationSearch = createSessionListConversationSearchHost({ list: { getSnapshot: () => ({ byId }) } })!
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, conversationSearch, mode: 'pane' }))
    const scope = screen.getByRole('combobox', { name: 'Search scope' }) as HTMLSelectElement
    expect(scope.value).toBe('all')
    fireEvent.change(screen.getByRole('combobox', { name: /Search sessions/ }), { target: { value: 'Planning' } })
    fireEvent.change(screen.getByLabelText('Updated since (UTC)'), { target: { value: '2026-01-01' } })
    const results = screen.getByRole('listbox', { name: 'Search results' })
    await waitFor(() => expect(within(results).getAllByRole('option')).toHaveLength(1))
    expect(within(results).getByRole('option', { name: 'Planning newest' })).toBeTruthy()
    expect(screen.getByText('Pane and command catalogs do not provide update times; they are excluded by this time condition.')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Resource category' }), { target: { value: 'pane' } })
    expect((screen.getByLabelText('Updated since (UTC)') as HTMLInputElement).value).toBe('')
    expect(scope.value).toBe('all')
    expect(screen.getByText('Filters that do not apply to this category were removed. The search scope is unchanged.')).toBeTruthy()
  })

  it('sorts the complete local catalog by name without rewriting matching or source IDs', () => {
    const { registry, commands, controller } = fixture()
    registry.registerView({ descriptor: { kind: 'docs.z', label: 'Zeta', componentKey: 'z', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true }, component: () => null })
    registry.registerView({ descriptor: { kind: 'docs.a', label: 'Alpha', componentKey: 'a', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true }, component: () => null })
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Resource category' }), { target: { value: 'pane' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort within each group' }), { target: { value: 'name' } })
    expect(within(screen.getByRole('listbox', { name: 'Search results' })).getAllByRole('option').map(option => option.getAttribute('aria-label'))).toEqual(['Alpha', 'Git', 'Zeta'])
  })

  it('offers eight discovery categories and 35 resources, and keeps queries when selecting an unconnected source', () => {
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' }))
    const discovery = screen.getByRole('region', { name: 'Explore by category' })
    expect(within(discovery).getAllByRole('button')).toHaveLength(8)
    const category = screen.getByRole('combobox', { name: 'Resource category' }) as HTMLSelectElement
    expect(category.options).toHaveLength(47)
    const search = screen.getByRole('combobox', { name: /Search sessions/ }) as HTMLInputElement
    fireEvent.change(search, { target: { value: 'Git' } })
    expect(screen.queryByRole('region', { name: 'Explore by category' })).toBeNull()
    fireEvent.change(category, { target: { value: 'skill' } })
    expect(search.value).toBe('Git')
    expect(screen.getByText('This category is not connected to search yet. Your query is kept; choose another category to continue.')).toBeTruthy()
    const results = screen.getByRole('listbox', { name: 'Search results' })
    expect(within(results).queryAllByRole('option')).toHaveLength(0)
    fireEvent.change(category, { target: { value: 'pane' } })
    expect(within(results).getByRole('option', { name: 'Git' })).toBeTruthy()
  })

  it('treats recent, opened and frequent as quick views rather than resource categories', () => {
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane', storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }))
    const category = screen.getByRole('combobox', { name: 'Resource category' })
    const results = screen.getByRole('listbox', { name: 'Search results' })
    fireEvent.change(category, { target: { value: 'quick:opened' } })
    expect(within(results).getAllByRole('option')).toHaveLength(1)
    expect(within(results).getByRole('option', { name: 'Git' })).toBeTruthy()
    fireEvent.change(category, { target: { value: 'quick:recent' } })
    // The fixture actually opened Git, so the controller's recent reference is valid.
    expect(within(results).getAllByRole('option')).toHaveLength(1)
    expect(within(results).getByRole('option', { name: 'Git' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Explore by category' })).toBeNull()
    fireEvent.change(category, { target: { value: 'all' } })
    expect(screen.getByRole('region', { name: 'Explore by category' })).toBeTruthy()
  })

  it('browses uncached registered panes with an empty query and expands a result group', () => {
    const { registry, commands, controller } = fixture()
    for (let i = 0; i < 8; i++) registry.registerView({
      descriptor: { kind: `docs.${i}`, label: `Document ${i}`, componentKey: `doc-${i}`, role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true }, component: () => null,
    })
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' }))
    const search = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(search, { target: { value: 'Document' } })
    const results = screen.getByRole('listbox', { name: 'Search results' })
    expect(within(results).getAllByRole('option')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'View all' }))
    expect(within(results).getAllByRole('option')).toHaveLength(8)
    fireEvent.change(search, { target: { value: '' } })
    expect(within(results).getByRole('option', { name: 'Document 7' })).toBeTruthy()
  })

  it('does not hijack category selection, text cursor movement, or IME composition', () => {
    const { registry, commands, controller } = fixture()
    const execute = vi.spyOn(commands, 'execute')
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, mode: 'pane' }))
    const search = screen.getByRole('combobox', { name: /Search sessions/ })
    fireEvent.change(search, { target: { value: 'Commit' } })
    expect(fireEvent.keyDown(search, { key: 'ArrowRight' })).toBe(true)
    expect(fireEvent.keyDown(search, { key: 'Home' })).toBe(true)
    expect(fireEvent.keyDown(screen.getByRole('combobox', { name: 'Resource category' }), { key: 'ArrowDown' })).toBe(true)
    fireEvent.compositionStart(search)
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('keeps combobox result IDs unique across two search panes', () => {
    const first = fixture()
    const second = fixture()
    render(createElement('div', null,
      createElement(WorkspaceSearchOverlay, { ...first, mode: 'pane' }),
      createElement(WorkspaceSearchOverlay, { ...second, mode: 'pane' })))
    const inputs = screen.getAllByRole('combobox', { name: /Search sessions/ })
    const ids = inputs.map(input => input.getAttribute('aria-controls'))
    expect(new Set(ids).size).toBe(2)
    for (const input of inputs) {
      const list = document.getElementById(input.getAttribute('aria-controls')!)!
      expect(list.contains(document.getElementById(input.getAttribute('aria-activedescendant')!))).toBe(true)
    }
  })

  it('groups empty-query results and opens the selected pane with Enter', async () => {
    const { registry, commands, controller } = fixture()
    const onClose = vi.fn()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose }))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    expect(within(dialog).getByRole('button', { name: 'Pin search as a pane' })).toBeTruthy()
    expect(within(dialog).getByText('Open')).toBeTruthy()
    expect(within(dialog).queryByRole('option', { name: /Legacy Compat/ })).toBeNull()
    const search = within(dialog).getByRole('combobox', { name: /Search sessions|搜索会话/ })
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
    fireEvent.change(within(dialog).getByRole('combobox', { name: /Search sessions|搜索会话/ }), { target: { value: 'Commit' } })
    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('preserves the dialog and query when the search pane provider is missing', async () => {
    const { registry, commands, controller } = fixture()
    render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() }))
    const input = screen.getByRole('combobox', { name: /Search sessions/ }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Git' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pin search as a pane' }))
    expect(Object.values(controller.getSnapshot().views).some(view => view.kind === DSH_WORKSPACE_SEARCH_VIEW_KIND)).toBe(false)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(input.value).toBe('Git')
    expect(await screen.findByText('The search pane could not be opened. Your query and filters are kept here.')).toBeTruthy()
  })

  it('keeps the dialog when a registered search pane never mounts and rejects its late acknowledgment', async () => {
    vi.useFakeTimers()
    try {
      const { registry, commands, controller } = fixture()
      registry.registerView({ descriptor: { kind: DSH_WORKSPACE_SEARCH_VIEW_KIND, label: 'Search', componentKey: 'search', role: 'utility', preferredRegion: 'right', retention: 'recreate', singleton: true }, component: () => null })
      const close = vi.fn(), restoreFocus = vi.fn()
      render(createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: close, restoreFocus }))
      const input = screen.getByRole('combobox', { name: /Search sessions/ }) as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Git' } })
      fireEvent.click(screen.getByRole('button', { name: 'Pin search as a pane' }))
      const channel = searchHandoffChannel(controller), packet = channel.getSnapshot()!
      expect(packet.query).toBe('Git')
      expect(close).not.toHaveBeenCalled()
      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(input.value).toBe('Git')
      expect(screen.getByText('The search pane could not be opened. Your query and filters are kept here.')).toBeTruthy()
      expect(channel.acknowledge(packet)).toBe(false)
      expect(close).not.toHaveBeenCalled()
      expect(restoreFocus).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Pin search as a pane' }))
      const cancelled = channel.getSnapshot()!
      fireEvent.change(input, { target: { value: 'Commit' } })
      await act(async () => {})
      expect(channel.getSnapshot()).toBeUndefined()
      expect(channel.acknowledge(cancelled)).toBe(false)
      expect(input.value).toBe('Commit')
      expect(close).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })

  it.each([360, 560, 960] as const)('keeps input and close visible at %spx', width => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    const { registry, commands, controller } = fixture()
    const view = render(createElement('div', { style: { width, height: 800, position: 'relative' } },
      createElement(WorkspaceSearchOverlay, { registry, commands, controller, onClose: vi.fn() })))
    const dialog = screen.getByRole('dialog', { name: 'Search and open' })
    expect(within(dialog).getByRole('combobox', { name: /Search sessions|搜索会话/ })).toBeTruthy()
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
    expect(within(dialog).getByRole('combobox', { name: /Search sessions|搜索会话/ })).toBeTruthy()
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
    fireEvent.change(within(dialog).getByRole('combobox', { name: /Search sessions|搜索会话/ }), { target: { value: '超长中文标题需要被截断' } })
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
    fireEvent.change(within(english).getByRole('combobox', { name: /Search sessions|搜索会话/ }), { target: { value: 'Git' } })
    const englishKey = within(english).getByRole('option', { name: /Git/ }).getAttribute('data-search-option')
    act(() => { setActiveLocale('zh') })
    const chinese = screen.getByRole('dialog', { name: '搜索与打开' })
    expect(within(chinese).getByRole('option', { name: /Git/ }).getAttribute('data-search-option')).toBe(englishKey)
    expect(within(chinese).getByRole('combobox', { name: '资源分类' })).toBeTruthy()
    expect(within(chinese).getByRole('option', { name: '窗格' })).toBeTruthy()
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
    fireEvent.change(within(dialog).getByRole('combobox', { name: /Search sessions|搜索会话/ }), { target: { value: 'Git' } })
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
    fireEvent.change(within(dialog).getByRole('combobox', { name: /Search sessions|搜索会话/ }), { target: { value: 'Planning' } })
    const resultList = within(within(dialog).getByRole('listbox', { name: 'Search results' }))
    await resultList.findByRole('option', { name: 'Planning 0' })
    expect(within(dialog).getByRole('button', { name: 'Load more' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Load more' })).toBeNull())
    fireEvent.click(resultList.getByRole('option', { name: 'Planning 0' }))
    await waitFor(() => expect(open).toHaveBeenCalledWith('session:0'))
  })
})
