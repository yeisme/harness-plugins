import { describe, expect, it, vi } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { createUnifiedHostAdapter, convertLegacyWorkspace, isUnifiedWorkspaceHost, type UnifiedWorkspaceHost } from '../src/unified-host.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { createPaneWorkspace, reducePaneWorkspace } from '../src/workspace.js'

function bench() {
  const listeners = new Set<() => void>()
  const host: UnifiedWorkspaceHost = {
    version: 'workspace.unified.v1',
    source: { getSnapshot: () => ({ layout: { workspaceId: 'project-a', root: null, groups: {}, panes: {}, focused: null, maximized: null, floating: [] } }), subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } },
    registerView: vi.fn(() => () => {}), openPane: vi.fn(), focusPane: vi.fn(), closePane: vi.fn(async () => {}),
    pinPane: vi.fn(), movePane: vi.fn(), maximize: vi.fn(), reset: vi.fn(),
  }
  const registry = new PaneViewRegistry({ capabilities: new Set(['pane.workbench.v1']) })
  registry.registerView({ descriptor: { kind: 'test.editor', label: 'Editor', componentKey: 'editor', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: false }, component: () => null })
  const adapter = createUnifiedHostAdapter(host, registry, () => ({ sessionId: 'session-a', workspaceId: 'project-a' }))
  return { host, registry, adapter, listeners }
}
const request = { kind: 'test.editor', resourceKey: 'document:one', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: false } as const

describe('unified host compatibility adapter', () => {
  it('delegates opening and movement without mutating a plugin layout or its saved layouts', () => {
    const { host, registry, adapter } = bench()
    const persist = { load: vi.fn(), save: vi.fn(), savePreset: vi.fn() }
    const controller = new PaneWorkbenchController({ registry, layoutDelegate: adapter.delegate, persistence: persist as never })
    controller.openView(request)
    expect(host.openPane).toHaveBeenCalledWith(expect.objectContaining({ kind: 'test.editor', resourceKey: 'document:one', sessionId: 'session-a', workspaceId: 'project-a' }))
    controller.dispatch({ type: 'move_view', viewId: 'pane-a', targetGroupId: 'group-b', index: 2 })
    expect(host.movePane).toHaveBeenCalledWith('pane-a', { type: 'tab', groupId: 'group-b', index: 2 })
    controller.switchSession('session-b'); controller.dispose(); adapter.dispose()
    expect(persist.load).not.toHaveBeenCalled()
    expect(persist.save).not.toHaveBeenCalled()
    expect(persist.savePreset).not.toHaveBeenCalled()
  })
  it('does not claim an unavailable provider opened successfully', () => {
    const { host, adapter } = bench()
    const result = adapter.delegate.dispatch({ type: 'open_view', request: { ...request, kind: 'missing.provider' } })
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/unavailable/)
    expect(host.openPane).not.toHaveBeenCalled()
    adapter.dispose()
  })
  it('keeps dirty view protection in the registered host close callback', () => {
    const { host, adapter } = bench()
    const off = adapter.mount({ inject: (_name, setup) => setup(), register: () => () => {} })
    adapter.delegate.dispatch({ type: 'open_view', request: { ...request, viewId: 'dirty-editor', dirty: true } })
    const registration = vi.mocked(host.registerView).mock.calls[0]![0]
    expect(registration.beforeClose?.('dirty-editor')).toBe(false)
    adapter.delegate.dispatch({ type: 'set_view_dirty', viewId: 'dirty-editor', dirty: false })
    expect(registration.beforeClose?.('dirty-editor')).toBe(true)
    off(); adapter.dispose()
  })
  it('protects dirty editors opened directly by the host catalog', () => {
    const { host, adapter } = bench()
    host.source.getSnapshot = () => ({ layout: {
      workspaceId: 'project-a', root: { type: 'group', id: 'group-one' },
      groups: { 'group-one': { id: 'group-one', panes: ['catalog-editor'], active: 'catalog-editor' } },
      panes: { 'catalog-editor': { id: 'catalog-editor', kind: 'test.editor', title: 'Editor', pinned: true } },
      focused: 'group-one', maximized: null, floating: [],
    } })
    const off = adapter.mount({ inject: (_name, setup) => setup(), register: () => () => {} })
    adapter.delegate.dispatch({ type: 'set_view_dirty', viewId: 'catalog-editor', dirty: true })
    const registration = vi.mocked(host.registerView).mock.calls[0]![0]
    expect(registration.beforeClose?.('catalog-editor')).toBe(false)
    adapter.delegate.dispatch({ type: 'close_view', viewId: 'catalog-editor', decision: 'confirm' })
    expect(registration.beforeClose?.('catalog-editor')).toBe(true)
    off(); adapter.dispose()
  })
  it('imports only safe legacy references and does not guess project ownership', () => {
    const old = reducePaneWorkspace(createPaneWorkspace(), { type: 'open_view', request: { ...request, metadata: { draft: 'private draft stays outside layout import' } } }).state
    const imported = convertLegacyWorkspace(old)
    expect(imported.workspaceId).toBe('unassigned')
    expect(JSON.stringify(imported)).not.toContain('private draft')
    expect(Object.values(imported.panes)[0]).toMatchObject({ kind: 'test.editor', resourceKey: 'document:one' })
    expect(Object.values(imported.panes)[0]?.workspaceId).toBeUndefined()
  })
  it('does not mistake a legacy attach-only service for a unified host', () => {
    expect(isUnifiedWorkspaceHost({ attach: () => {} })).toBe(false)
    expect(isUnifiedWorkspaceHost(bench().host)).toBe(true)
  })
  it('registers the picker-hidden search pane in the unified host catalog so host-opened panes resolve a renderer', () => {
    const { host, registry, adapter } = bench()
    const slots = {
      register: vi.fn(() => vi.fn()),
      inject: (_name: string, setup: () => () => void) => { const dispose = setup(); return () => dispose() },
    }
    registry.registerView({
      descriptor: { kind: 'dsh.workspace-search', label: 'Search', componentKey: 'dsh-workspace-search', role: 'utility', preferredRegion: 'right', retention: 'recreate', singleton: true },
      component: () => null,
      showInPicker: false,
    })
    registry.registerView({
      descriptor: { kind: 'dsh.file-preview', label: 'File', componentKey: 'dsh-file-preview', role: 'content', preferredRegion: 'right', retention: 'recreate', singleton: false },
      component: () => null,
      showInPicker: false,
    })
    adapter.mount(slots as never)
    const registeredKinds = host.registerView.mock.calls.map(call => call[0]?.kind as string)
    expect(registeredKinds).toContain('dsh.workspace-search')
    expect(registeredKinds).toContain('test.editor')
    expect(registeredKinds).not.toContain('dsh.file-preview')
    const slotKeys = slots.register.mock.calls.map(call => call[0]?.key as string)
    expect(slotKeys).toContain('yeisme:dsh.workspace-search')
    adapter.dispose()
  })
})
