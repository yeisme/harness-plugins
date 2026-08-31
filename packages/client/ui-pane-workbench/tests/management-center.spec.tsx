// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { setActiveLocale } from '../src/i18n/locale.js'
import { PaneCloseUndoToast, PaneManagementCenter } from '../src/management-center.js'
import type { PaneConversationSearchHostV1, PaneWorkspaceContextProviderV1 } from '../src/management.js'
import { PaneViewContent, REGION_STYLES } from '../src/region-chrome.js'
import { PaneViewRegistry } from '../src/view-registry.js'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  setActiveLocale('en')
})

function registryFixture(): PaneViewRegistry {
  const registry = new PaneViewRegistry({ capabilities: new Set() })
  registry.registerView({
    descriptor: { kind: 'git.status', label: 'Git', componentKey: 'git', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { group: 'development', owner: 'git', keywords: ['source control'] } },
    component: () => null,
  })
  registry.registerView({
    descriptor: { kind: 'terminal.session', label: 'Terminal', componentKey: 'terminal', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: false, presentation: { group: 'development', owner: 'terminal' } },
    component: () => null,
  })
  return registry
}

describe('PaneManagementCenter', () => {
  it('does not call conversation search until the user explicitly opts in, then cancels stale queries', async () => {
    vi.useFakeTimers()
    const calls: AbortSignal[] = []
    const search = vi.fn(async (_request, signal?: AbortSignal) => {
      if (signal !== undefined) calls.push(signal)
      return { items: [], status: 'ready' as const }
    })
    const host: PaneConversationSearchHostV1 = { capability: 'pane.conversation-search.v1', search, open: vi.fn() }
    render(createElement(PaneManagementCenter, {
      mode: 'open', registry: registryFixture(), controller: new PaneWorkbenchController(), conversationSearch: host, onClose: vi.fn(),
    }))
    const searchbox = screen.getByRole('searchbox')
    fireEvent.change(searchbox, { target: { value: 'first query' } })
    await act(async () => { vi.advanceTimersByTime(200); await Promise.resolve() })
    expect(search).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Search conversations' }))
    await act(async () => { vi.advanceTimersByTime(160); await Promise.resolve() })
    expect(search).toHaveBeenCalledTimes(1)

    fireEvent.change(searchbox, { target: { value: 'second query' } })
    expect(calls[0]?.aborted).toBe(true)
    await act(async () => { vi.advanceTimersByTime(160); await Promise.resolve() })
    expect(search).toHaveBeenCalledTimes(2)
  })

  it('searches authorized other workspaces only after an explicit scope change', async () => {
    vi.useFakeTimers()
    const open = vi.fn()
    const search = vi.fn(async () => ({
      status: 'ready' as const,
      items: [
        { workspaceRef: 'workspace:other', ref: 'tab:git', source: 'tab' as const, title: 'Remote Git', kind: 'git.status', groupId: 'development', description: 'Remote workspace tab summary' },
        { workspaceRef: 'workspace:other', ref: 'tab:bare', source: 'tab' as const, title: 'Bare Remote Tab', kind: 'terminal.session', groupId: 'development' },
      ],
    }))
    const workspaceContext: PaneWorkspaceContextProviderV1 = {
      getSnapshot: () => ({ workspaceRef: 'local', revision: '1' }),
      listWorkspaces: () => [{ workspaceRef: 'workspace:local', label: 'Local' }, { workspaceRef: 'workspace:other', label: 'Other project' }],
      search,
      open,
    }
    const controller = new PaneWorkbenchController()
    controller.setManagementContext('local')
    render(createElement(PaneManagementCenter, { mode: 'open', registry: registryFixture(), controller, workspaceContext, onClose: vi.fn() }))
    expect(search).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Advanced filters' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Workspace' }), { target: { value: 'workspace:other' } })
    await act(async () => { vi.advanceTimersByTime(160); await Promise.resolve() })
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ workspaceRefs: ['workspace:other'], limit: 20 }), expect.any(AbortSignal))
    expect(screen.getAllByText('Remote workspace tab summary').length).toBeGreaterThan(0)
    // A remote item without a host description renders no description line but keeps its row.
    const bareRow = document.querySelector('[data-pane-management-entry="workspace:workspace:other:tab:bare"]')
    expect(bareRow?.querySelector('.pwr-management-row-desc')).toBeNull()
    expect(within(bareRow as HTMLElement).getByText('Bare Remote Tab')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Remote Git/ }))
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ ref: 'tab:git', workspaceRef: 'workspace:other' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show details: Remote Git' }))
    const panel = screen.getByRole('region', { name: 'Pane details' })
    expect(within(panel).getByText('Remote workspace tab summary')).toBeTruthy()
    expect(within(panel).getByText('Other project')).toBeTruthy()
  })

  it('keeps advanced filters collapsed, counts active filters, and resets them together', () => {
    render(createElement(PaneManagementCenter, { mode: 'open', registry: registryFixture(), controller: new PaneWorkbenchController(), onClose: vi.fn() }))
    const toggle = screen.getByRole('button', { name: /Advanced filters/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('combobox', { name: 'Owner' })).toBeNull()

    fireEvent.click(toggle)
    const owner = screen.getByRole('combobox', { name: 'Owner' }) as HTMLSelectElement
    fireEvent.change(owner, { target: { value: 'git' } })
    expect(toggle.textContent).toContain('1')
    fireEvent.click(toggle)
    expect(screen.queryByRole('combobox', { name: 'Owner' })).toBeNull()

    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect((screen.getByRole('combobox', { name: 'Owner' }) as HTMLSelectElement).value).toBe('all')
    expect(toggle.textContent).not.toContain('1')
  })

  it('opens group creation and selected-item actions only when requested', () => {
    const registry = registryFixture()
    render(createElement(PaneManagementCenter, { mode: 'open', registry, controller: new PaneWorkbenchController(), onClose: vi.fn() }))
    expect(screen.queryByRole('textbox', { name: 'Group name' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }))
    expect(screen.getByRole('textbox', { name: 'Group name' })).toBeTruthy()

    cleanup()
    const controller = new PaneWorkbenchController()
    controller.openView({ kind: 'git.status', resourceKey: 'view:git.status', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, title: 'Git' })
    render(createElement(PaneManagementCenter, { mode: 'manage', registry, controller, onClose: vi.fn() }))
    expect(screen.queryByRole('button', { name: 'Close selected safely' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Git' }))
    expect(screen.getByRole('button', { name: 'Close selected safely' })).toBeTruthy()
    expect(screen.getByText('1 selected')).toBeTruthy()
  })

  it('opens the target picker from the discoverable row chevron', () => {
    render(createElement(PaneManagementCenter, { mode: 'open', registry: registryFixture(), controller: new PaneWorkbenchController(), onClose: vi.fn() }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose open target for Git' }))
    expect(screen.getByRole('dialog', { name: 'Open target' })).toBeTruthy()
  })

  it('shows bounded local typo suggestions without invoking conversation search', () => {
    const registry = registryFixture()
    registry.registerView({
      descriptor: { kind: 'explorer.files', label: 'Explorer', componentKey: 'explorer', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { group: 'development' } },
      component: () => null,
    })
    const search = vi.fn()
    render(createElement(PaneManagementCenter, {
      mode: 'open', registry, controller: new PaneWorkbenchController(),
      conversationSearch: { capability: 'pane.conversation-search.v1', search, open: vi.fn() }, onClose: vi.fn(),
    }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Exploer' } })
    expect(screen.getByRole('heading', { name: 'You might be looking for' })).toBeTruthy()
    expect(screen.getByText('Explorer')).toBeTruthy()
    expect(search).not.toHaveBeenCalled()
  })

  it('localizes built-in provider labels and preserves UI state across locale switches', () => {
    setActiveLocale('zh')
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registry.registerView({
      descriptor: { kind: 'git.status', label: 'Source Control', componentKey: 'git', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { group: 'development', owner: 'git' } },
      component: () => null,
      i18n: { namespace: 'paneWorkbench', labelKey: 'rail.sourceControl' },
    })
    registry.registerView({
      descriptor: { kind: 'subagent.monitor', label: 'Agents', componentKey: 'agents', role: 'navigator', preferredRegion: 'right', retention: 'keep-alive', singleton: true, presentation: { group: 'agents', owner: 'ordo' } },
      component: () => null,
      i18n: { namespace: 'paneWorkbench', labelKey: 'rail.agents' },
    })
    render(createElement(PaneManagementCenter, { mode: 'open', registry, controller: new PaneWorkbenchController(), onClose: vi.fn() }))
    expect(screen.getByText('源代码管理')).toBeTruthy()
    expect(screen.getAllByText('智能体').length).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: '窗格中心' }).textContent).not.toMatch(/Pane|Tab|Agent/)

    fireEvent.click(screen.getByRole('button', { name: /高级筛选/ }))
    fireEvent.change(screen.getByRole('combobox', { name: '所有者' }), { target: { value: 'git' } })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '源代码' } })
    act(() => { setActiveLocale('en') })
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('源代码')
    expect((screen.getByRole('combobox', { name: 'Owner' }) as HTMLSelectElement).value).toBe('git')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Owner' }), { target: { value: 'all' } })
    expect(screen.getByText('Source Control')).toBeTruthy()
  })

  it('renders partial search state and retries only transient errors', async () => {
    vi.useFakeTimers()
    const partial: PaneConversationSearchHostV1 = {
      capability: 'pane.conversation-search.v1',
      search: vi.fn(async () => ({ status: 'partial' as const, reason: 'offline', items: [] })),
      open: vi.fn(),
    }
    const first = render(createElement(PaneManagementCenter, { mode: 'open', registry: registryFixture(), controller: new PaneWorkbenchController(), conversationSearch: partial, onClose: vi.fn() }))
    fireEvent.click(screen.getByRole('button', { name: 'Search conversations' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pane' } })
    await act(async () => { vi.advanceTimersByTime(200); await Promise.resolve() })
    expect(screen.getByText('Some results may be unavailable.')).toBeTruthy()

    first.unmount()
    let attempt = 0
    const failing: PaneConversationSearchHostV1 = {
      capability: 'pane.conversation-search.v1',
      search: vi.fn(async () => (++attempt === 1
        ? { status: 'offline' as const, reason: 'offline', items: [] }
        : { status: 'permission_denied' as const, reason: 'permission_denied', items: [] })),
      open: vi.fn(),
    }
    render(createElement(PaneManagementCenter, { mode: 'open', registry: registryFixture(), controller: new PaneWorkbenchController(), conversationSearch: failing, onClose: vi.fn() }))
    fireEvent.click(screen.getByRole('button', { name: 'Search conversations' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pane' } })
    await act(async () => { vi.advanceTimersByTime(200); await Promise.resolve() })
    fireEvent.click(screen.getByRole('button', { name: 'Retry search' }))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('You do not have permission to search this source.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry search' })).toBeNull()
  })

  it('ships a full-screen 390px contract with one scrollable result region', () => {
    expect(REGION_STYLES).toContain('.pwr-management-center{inset:0;width:100vw;height:100vh;height:100dvh')
    expect(REGION_STYLES).toContain('.pwr-management-filter-grid{grid-template-columns:1fr}')
    expect(REGION_STYLES).toContain('.pwr-management-list{flex:1;min-height:120px;max-height:none')
    expect(REGION_STYLES).toContain('.pwr-management-target-trigger')
    expect(REGION_STYLES).toContain('{min-height:44px}')
  })

  it('closes safe selections immediately and lists protected tabs for explicit per-item confirmation', () => {
    const controller = new PaneWorkbenchController()
    controller.openView({ kind: 'file.preview', resourceKey: 'file:clean', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, title: 'Clean' })
    controller.openView({ kind: 'terminal.session', resourceKey: 'terminal:one', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: false, title: 'Terminal' })
    controller.openView({ kind: 'file.preview', resourceKey: 'file:deny', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, title: 'Locked', closePolicy: 'deny' })
    render(createElement(PaneManagementCenter, { mode: 'manage', registry: registryFixture(), controller, onClose: vi.fn() }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'Clean' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Terminal' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Locked' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close selected safely' }))

    expect(Object.values(controller.getSnapshot().views).some(view => view.title === 'Clean')).toBe(false)
    const protectedSection = screen.getByRole('region', { name: 'Protected tabs' })
    expect(within(protectedSection).getByText('Terminal cannot be resumed')).toBeTruthy()
    expect(within(protectedSection).getByText('Owner prevents closing')).toBeTruthy()
    expect(within(protectedSection).getAllByRole('button', { name: 'Close anyway' })).toHaveLength(1)

    fireEvent.click(within(protectedSection).getByRole('button', { name: 'Close anyway' }))
    expect(Object.values(controller.getSnapshot().views).some(view => view.title === 'Terminal')).toBe(false)
    expect(Object.values(controller.getSnapshot().views).some(view => view.title === 'Locked')).toBe(true)
  })

  it('windows management lists after 50 tabs and keeps search results bounded', async () => {
    const controller = new PaneWorkbenchController()
    for (let index = 0; index < 55; index += 1) {
      controller.openView({
        kind: 'file.preview', resourceKey: `file:item-${index}`, role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, title: `Document ${index}`,
      })
    }
    render(createElement(PaneManagementCenter, { mode: 'manage', registry: registryFixture(), controller, onClose: vi.fn() }))
    expect(document.querySelector('.pwr-management-list-virtual')).not.toBeNull()
    expect(document.querySelectorAll('[data-pane-management-entry]').length).toBeLessThan(55)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Document 54' } })
    await waitFor(() => expect(screen.getByRole('button', { name: /^Document 54/ })).toBeTruthy())
  })

  it('renders pane descriptions in rows and finds panes by description text', () => {
    const registry = registryFixture()
    registry.registerView({
      descriptor: { kind: 'media.gallery', label: '媒体库', componentKey: 'media', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { group: 'creator', description: '预览图片、音频、视频与 PDF 媒体文件。' } },
      component: () => null,
    })
    render(createElement(PaneManagementCenter, { mode: 'open', registry, controller: new PaneWorkbenchController(), onClose: vi.fn() }))
    expect(screen.getByText('预览图片、音频、视频与 PDF 媒体文件。')).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'PDF' } })
    expect(screen.getByText('媒体库')).toBeTruthy()
    expect(screen.queryByText('Terminal')).toBeNull()
  })

  it('opens pane details from the info button or ArrowRight and clears them on query change', () => {
    const registry = registryFixture()
    const onClose = vi.fn()
    render(createElement(PaneManagementCenter, { mode: 'open', registry, controller: new PaneWorkbenchController(), onClose }))

    fireEvent.click(screen.getByRole('button', { name: 'Show details: Git' }))
    const panel = screen.getByRole('region', { name: 'Pane details' })
    expect(screen.getByRole('button', { name: 'Show details: Git' }).getAttribute('aria-expanded')).toBe('true')
    expect(within(panel).getByText('No description provided for this pane.')).toBeTruthy()
    expect(within(panel).getByText('git.status')).toBeTruthy()
    expect(within(panel).getByText('source control')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: 'Hide details' }))
    expect(screen.queryByRole('region', { name: 'Pane details' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Show details: Git' }).getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show details: Git' }))

    const gitRow = screen.getAllByText('Git', { selector: '.pwr-management-row-copy strong' })[0]!.closest('button')!
    fireEvent.keyDown(gitRow, { key: 'ArrowRight' })
    expect(screen.getByRole('region', { name: 'Pane details' })).toBeTruthy()
    // ArrowUp/Down keep navigating rows while the detail panel stays open.
    fireEvent.keyDown(gitRow, { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-pane-management-index')).toBe('1')
    expect(screen.getByRole('region', { name: 'Pane details' })).toBeTruthy()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement?.getAttribute('data-pane-management-index')).toBe('0')
    fireEvent.keyDown(gitRow, { key: 'ArrowLeft' })
    expect(screen.queryByRole('region', { name: 'Pane details' })).toBeNull()

    fireEvent.keyDown(gitRow, { key: 'ArrowRight' })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz-no-match' } })
    expect(screen.queryByRole('region', { name: 'Pane details' })).toBeNull()

    // Escape collapses the detail panel before entering the target/close chain.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show details: Git' }))
    fireEvent.keyDown(screen.getByRole('region', { name: 'Pane details' }), { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Pane details' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show details: Git' }))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('refreshes pane descriptions when the active locale switches', () => {
    const registry = registryFixture()
    registry.registerView({
      descriptor: { kind: 'i18n.pane', label: 'I18n Pane', componentKey: 'i18n', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: true },
      component: () => null,
      i18n: { namespace: 'paneWorkbench', labelKey: 'capabilities.title', descriptionKey: 'capabilities.description' },
    })
    render(createElement(PaneManagementCenter, { mode: 'open', registry, controller: new PaneWorkbenchController(), onClose: vi.fn() }))
    expect(screen.getByText('Inspect the pane capabilities this host provides and their evidence.')).toBeTruthy()
    act(() => { setActiveLocale('zh') })
    expect(screen.getByText('查看当前宿主提供的窗格能力及其证据。')).toBeTruthy()
  })

  it('uses the host snippet as the description line for conversation results', async () => {
    vi.useFakeTimers()
    const host: PaneConversationSearchHostV1 = {
      capability: 'pane.conversation-search.v1',
      search: vi.fn(async () => ({
        status: 'ready' as const,
        items: [{ sessionRef: 's1', messageRef: 'm1', title: 'Chat hit', snippet: 'the pinned pane contract', updatedAt: '2026-08-28T00:00:00.000Z' }],
      })),
      open: vi.fn(),
    }
    render(createElement(PaneManagementCenter, { mode: 'open', registry: registryFixture(), controller: new PaneWorkbenchController(), conversationSearch: host, onClose: vi.fn() }))
    fireEvent.click(screen.getByRole('button', { name: 'Search conversations' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pane' } })
    await act(async () => { vi.advanceTimersByTime(200); await Promise.resolve() })
    expect(screen.getByText('the pinned pane contract')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show details: Chat hit' }))
    const panel = screen.getByRole('region', { name: 'Pane details' })
    expect(within(panel).getByText('2026-08-28T00:00:00.000Z')).toBeTruthy()
  })

  it('stamps history details with the closed time', () => {
    const controller = new PaneWorkbenchController()
    controller.openView({ kind: 'file.preview', resourceKey: 'file:one', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, title: 'Closed doc' })
    const view = Object.values(controller.getSnapshot().views)[0]!
    controller.dispatch({ type: 'close_view', viewId: view.id })
    render(createElement(PaneManagementCenter, { mode: 'manage', registry: registryFixture(), controller, onClose: vi.fn() }))
    fireEvent.click(screen.getByRole('button', { name: 'Closed history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show details: Closed doc' }))
    const panel = screen.getByRole('region', { name: 'Pane details' })
    expect(panel.querySelector('[data-pane-management-detail-field="closedAt"]')?.textContent ?? '').toMatch(/20\d\d/)
  })

  it('keeps the center open when Escape dismisses the open-target picker first', () => {
    const onClose = vi.fn()
    render(createElement(PaneManagementCenter, { mode: 'open', registry: registryFixture(), controller: new PaneWorkbenchController(), onClose }))
    const gitRow = screen.getAllByText('Git', { selector: '.pwr-management-row-copy strong' })[0]!.closest('button')!
    fireEvent.keyDown(gitRow, { key: 'Enter', shiftKey: true })
    expect(screen.getByRole('dialog', { name: 'Open target' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Open target' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Open target' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(document.activeElement ?? gitRow, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('offers a 10-second undo that restores the closed batch in place', () => {
    vi.useFakeTimers()
    const controller = new PaneWorkbenchController()
    controller.openView({ kind: 'file.preview', resourceKey: 'file:undo', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, title: 'Undo me' })
    const view = Object.values(controller.getSnapshot().views)[0]!
    controller.dispatch({ type: 'close_view', viewId: view.id })
    render(createElement(PaneCloseUndoToast, { controller }))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(Object.values(controller.getSnapshot().views).map(item => item.title)).toContain('Undo me')
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('renders a Host-approved cached rendition when its provider is unavailable', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    const dispose = registry.registerView({
      descriptor: { kind: 'file.preview', label: 'File', componentKey: 'file', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false },
      component: () => null,
    })
    const controller = new PaneWorkbenchController({
      registry,
      renditionRenderer: {
        capability: 'pane.safe-rendition-renderer.v1',
        render: input => createElement('article', null, `Cached preview for ${input.kind}`),
      },
    })
    controller.openView({ kind: 'file.preview', resourceKey: 'file:deleted', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, title: 'Deleted file' })
    const view = Object.values(controller.getSnapshot().views)[0]!
    expect(controller.updateRestoreState(view.id, { scrollTop: 120 }, 'rendition:file-deleted:v1')).toBe(true)
    dispose()
    const orphaned = controller.getSnapshot().views[view.id]!
    render(createElement(PaneViewContent, { view: orphaned, registration: undefined, registry, controller, onClose: vi.fn() }))
    expect(screen.getByText('Cached preview for file.preview')).toBeTruthy()
    expect(document.querySelector('[data-pane-safe-rendition="true"]')).not.toBeNull()
  })
})
