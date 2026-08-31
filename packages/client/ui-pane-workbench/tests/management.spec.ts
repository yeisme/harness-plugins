import { describe, expect, it } from 'vitest'
import { PaneWorkbenchController } from '../src/controller.js'
import { t } from '../src/i18n/locale.js'
import {
  buildPaneManagementEntries,
  createClosedHistoryBatch,
  filterAndRankPaneEntries,
  PaneManagementPersistenceAdapter,
  pruneClosedHistory,
  resolvePaneManagementShortcut,
  sanitizePaneRestoreState,
  suggestSimilarPaneEntries,
  type PaneClosedHistoryBatchV1,
  type PaneManagementProfileV1,
  type PaneManagementScopeV1,
} from '../src/management.js'
import type { PaneWorkspaceStorageV1 } from '../src/persistence.js'
import { PaneViewRegistry } from '../src/view-registry.js'
import { createPaneWorkspace, reducePaneWorkspace, type PaneViewSpecV1, type PaneWorkspaceV1 } from '../src/workspace.js'

function storageFixture(): { readonly storage: PaneWorkspaceStorageV1; readonly values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    storage: {
      getItem: key => values.get(key),
      setItem: (key, value) => { values.set(key, value) },
      removeItem: key => { values.delete(key) },
    },
  }
}

function open(state: PaneWorkspaceV1, request: Partial<PaneViewSpecV1> & Pick<PaneViewSpecV1, 'kind' | 'resourceKey'>): PaneWorkspaceV1 {
  const result = reducePaneWorkspace(state, {
    type: 'open_view',
    request: {
      role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false,
      ...request,
    },
  })
  expect(result.accepted).toBe(true)
  return result.state
}

const profile: PaneManagementProfileV1 = {
  schema: 'pane.management.v1',
  groups: [],
  favoritePaneKinds: ['git.status'],
  recentPaneKinds: ['terminal.session'],
}

describe('Pane management contracts', () => {
  it('resolves default and remapped shortcuts through one shared keymap', () => {
    expect(resolvePaneManagementShortcut({ key: 'p', metaKey: true })).toBe('open_center')
    expect(resolvePaneManagementShortcut({ key: 'w', ctrlKey: true, shiftKey: true })).toBe('close_unpinned')
    expect(resolvePaneManagementShortcut({ key: 't', metaKey: true, shiftKey: true })).toBe('restore_closed')
    expect(resolvePaneManagementShortcut({ key: 'j', ctrlKey: true }, { openCenter: ['ctrl+j'] })).toBe('open_center')
    expect(resolvePaneManagementShortcut({ key: 'p', ctrlKey: true }, { openCenter: ['ctrl+j'] })).toBeUndefined()
  })

  it('accepts bounded UI state and rejects content, credentials, paths, URLs, and oversized values', () => {
    expect(sanitizePaneRestoreState({ scrollTop: 320, filter: 'dirty', selected: ['a'] })).toEqual({ scrollTop: 320, filter: 'dirty', selected: ['a'] })
    expect(sanitizePaneRestoreState({ content: 'private body' })).toBeUndefined()
    expect(sanitizePaneRestoreState({ token: 'secret' })).toBeUndefined()
    expect(sanitizePaneRestoreState({ file: '/home/user/private.txt' })).toBeUndefined()
    expect(sanitizePaneRestoreState({ href: 'https://example.com/private' })).toBeUndefined()
    expect(sanitizePaneRestoreState({ selection: 'x'.repeat(17_000) })).toBeUndefined()
  })

  it('keeps at most 50 fresh history batches and removes records older than 30 days', () => {
    let state = createPaneWorkspace()
    state = open(state, { kind: 'file.preview', resourceKey: 'file:one', title: 'One' })
    const viewId = Object.keys(state.views)[0]!
    const scope: PaneManagementScopeV1 = { kind: 'workspace', ref: 'workspace:test' }
    const seed = createClosedHistoryBatch({ state, viewIds: [viewId], scope, now: new Date('2026-08-28T00:00:00.000Z') })!
    const batches: PaneClosedHistoryBatchV1[] = Array.from({ length: 60 }, (_, index) => ({
      ...seed,
      id: `closed:test:${index}`,
      closedAt: new Date(Date.parse('2026-08-28T00:00:00.000Z') - index * 60_000).toISOString(),
      pinned: index === 0,
    }))
    batches.push({ ...seed, id: 'closed:expired', closedAt: '2026-07-01T00:00:00.000Z' })
    const pruned = pruneClosedHistory(batches, Date.parse('2026-08-28T00:00:00.000Z'))
    expect(pruned).toHaveLength(50)
    expect(pruned[0]?.id).toBe('closed:test:0')
    expect(pruned.some(batch => batch.id === 'closed:expired')).toBe(false)
  })

  it('seeds a newly available workspace bucket from session scope without deleting the fallback bucket', () => {
    const { storage, values } = storageFixture()
    const adapter = new PaneManagementPersistenceAdapter(storage)
    const session: PaneManagementScopeV1 = { kind: 'session', ref: 'session:one' }
    const workspace: PaneManagementScopeV1 = { kind: 'workspace', ref: 'workspace:one' }
    adapter.saveWorkspace({ schema: 'pane.management.v1', scope: session, groupMembership: { 'group:custom': ['git.status'] }, pinnedResourceKeys: ['view:git.status'] })
    adapter.seedScope(session, workspace)
    expect(adapter.loadWorkspace(workspace)).toMatchObject({
      scope: workspace,
      groupMembership: { 'group:custom': ['git.status'] },
      pinnedResourceKeys: ['view:git.status'],
    })
    expect(adapter.loadWorkspace(session).pinnedResourceKeys).toEqual(['view:git.status'])
    expect(values.size).toBeGreaterThanOrEqual(2)
  })

  it('ranks exact, active, opened, pinned, recent, available, then history results', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registry.registerView({
      descriptor: { kind: 'git.status', label: 'Git', componentKey: 'git', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { group: 'development', owner: 'git', keywords: ['source control'] } },
      component: () => null,
    })
    registry.registerView({
      descriptor: { kind: 'terminal.session', label: 'Terminal', componentKey: 'terminal', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: false, presentation: { group: 'development', owner: 'terminal' } },
      component: () => null,
    })
    let state = createPaneWorkspace()
    state = open(state, { kind: 'git.status', resourceKey: 'view:git.status', title: 'Git', pinned: true })
    const entries = buildPaneManagementEntries({ registrations: registry.snapshot(), state, history: [], profile })
    const ranked = filterAndRankPaneEntries(entries, 'git')
    expect(ranked[0]).toMatchObject({ source: 'tab', title: 'Git', active: true, pinned: true })
    expect(ranked.some(entry => entry.source === 'pane' && entry.kind === 'git.status')).toBe(true)
    expect(filterAndRankPaneEntries(entries, 'source control')[0]?.kind).toBe('git.status')
  })

  it('suggests at most three deterministic local typo matches without crossing filters', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    for (const [kind, label, owner] of [
      ['explorer.files', 'Explorer', 'files'],
      ['explorer.search', 'Explorer Search', 'files'],
      ['explorer.symbols', 'Explorer Symbols', 'files'],
      ['explorer.remote', 'Explorer Remote', 'remote'],
    ] as const) {
      registry.registerView({
        descriptor: { kind, label, componentKey: kind, role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { group: 'development', owner } },
        component: () => null,
      })
    }
    const entries = buildPaneManagementEntries({ registrations: registry.snapshot(), state: createPaneWorkspace(), history: [], profile })
    expect(filterAndRankPaneEntries(entries, 'Exploer')).toHaveLength(0)
    const suggestions = suggestSimilarPaneEntries(entries, 'Exploer', { sources: new Set(['pane']), owners: new Set(['files']) })
    expect(suggestions).toHaveLength(3)
    expect(suggestions.every(entry => entry.owner === 'files')).toBe(true)
    expect(suggestions.map(entry => entry.title)).toEqual(['Explorer', 'Explorer Search', 'Explorer Symbols'])
    expect(suggestSimilarPaneEntries(entries, 'x')).toEqual([])
  })

  it('carries pane descriptions through entries, matches description-only queries, and stamps history freshness', () => {
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    registry.registerView({
      descriptor: { kind: 'media.gallery', label: '媒体库', componentKey: 'media', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, presentation: { description: '预览图片、音频、视频与 PDF 媒体文件。' } },
      component: () => null,
    })
    registry.registerView({
      descriptor: { kind: 'plain.pane', label: 'Plain', componentKey: 'plain', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: true },
      component: () => null,
    })
    registry.registerView({
      descriptor: { kind: 'i18n.pane', label: 'I18n Pane', componentKey: 'i18n', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: true },
      component: () => null,
      i18n: { namespace: 'paneWorkbench', labelKey: 'capabilities.title', descriptionKey: 'capabilities.description' },
    })
    registry.registerView({
      descriptor: { kind: 'fallback.pane', label: 'Fallback', componentKey: 'fallback', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: true, presentation: { description: 'Descriptor fallback summary.' } },
      component: () => null,
      i18n: { namespace: 'paneWorkbench', labelKey: 'capabilities.title', descriptionKey: 'missing.description.key' },
    })
    let state = createPaneWorkspace()
    state = open(state, { kind: 'media.gallery', resourceKey: 'view:media.gallery', title: '媒体库' })
    const entries = buildPaneManagementEntries({ registrations: registry.snapshot(), state, history: [], profile })

    expect(entries.find(entry => entry.source === 'pane' && entry.kind === 'media.gallery')?.description).toBe('预览图片、音频、视频与 PDF 媒体文件。')
    expect(entries.find(entry => entry.source === 'tab' && entry.kind === 'media.gallery')?.description).toBe('预览图片、音频、视频与 PDF 媒体文件。')
    expect(entries.find(entry => entry.kind === 'i18n.pane')?.description).toBe(t('capabilities.description'))
    expect(entries.find(entry => entry.kind === 'fallback.pane')?.description).toBe('Descriptor fallback summary.')
    expect(entries.find(entry => entry.kind === 'plain.pane')?.description).toBeUndefined()

    const longDescription = 'x'.repeat(300)
    registry.registerView({
      descriptor: { kind: 'long.pane', label: 'Long', componentKey: 'long', role: 'utility', preferredRegion: 'bottom', retention: 'recreate', singleton: true, presentation: { description: longDescription } },
      component: () => null,
    })
    const rebuilt = buildPaneManagementEntries({ registrations: registry.snapshot(), state, history: [], profile })
    const bounded = rebuilt.find(entry => entry.kind === 'long.pane')?.description
    expect(bounded?.length).toBe(240)
    expect(bounded?.endsWith('…')).toBe(true)
    expect(filterAndRankPaneEntries(entries, 'PDF').every(entry => entry.kind === 'media.gallery')).toBe(true)

    const batch = createClosedHistoryBatch({ state, viewIds: [Object.keys(state.views)[0]!], scope: { kind: 'workspace', ref: 'ws' } })
    expect(batch).toBeDefined()
    const withHistory = buildPaneManagementEntries({ registrations: registry.snapshot(), state, history: [batch!], profile })
    const historyEntry = withHistory.find(entry => entry.source === 'history')
    expect(historyEntry?.description).toBe('预览图片、音频、视频与 PDF 媒体文件。')
    expect(historyEntry?.updatedAt).toBe(batch!.closedAt)
  })

  it('records safe-close history and restores tab order, pin state, active state, and approved UI state', () => {
    const { storage } = storageFixture()
    const managementPersistence = new PaneManagementPersistenceAdapter(storage)
    const controller = new PaneWorkbenchController({ managementPersistence })
    controller.setManagementContext('workspace:test')
    controller.openView({ kind: 'file.preview', resourceKey: 'file:one', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, title: 'One' })
    controller.openView({ kind: 'file.preview', resourceKey: 'file:two', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, title: 'Two', pinned: true })
    controller.openView({ kind: 'file.preview', resourceKey: 'file:dirty', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false, title: 'Dirty', dirty: true })
    const before = controller.getSnapshot()
    const one = Object.values(before.views).find(view => view.resourceKey === 'file:one')!
    const two = Object.values(before.views).find(view => view.resourceKey === 'file:two')!
    const originalOrder = before.groups[one.groupId]!.tabs.map(id => before.views[id]?.resourceKey)
    expect(controller.updateRestoreState(one.id, { scrollTop: 640, filter: 'changed' }, 'rendition:file-one:v1')).toBe(true)
    const result = controller.dispatch({ type: 'bulk_close_safe', groupId: one.groupId, mode: 'group' })
    expect(result.details?.bulkCloseSafe).toMatchObject({
      closedViewIds: expect.arrayContaining([one.id, two.id]),
      protectedViews: [expect.objectContaining({ reason: 'dirty' })],
    })
    const batch = controller.getManagementSnapshot().lastClosedBatch
    expect(batch?.entries).toHaveLength(2)
    expect(controller.restoreClosedBatch(batch?.id)).toBe(true)
    const restored = controller.getSnapshot()
    expect(restored.groups[one.groupId]?.tabs.map(id => restored.views[id]?.resourceKey)).toEqual(originalOrder)
    const restoredOne = Object.values(restored.views).find(view => view.resourceKey === 'file:one')!
    const restoredTwo = Object.values(restored.views).find(view => view.resourceKey === 'file:two')!
    expect(restoredTwo.pinned).toBe(true)
    expect(controller.getRestoreState(restoredOne.id)).toEqual({ state: { scrollTop: 640, filter: 'changed' }, renditionRef: 'rendition:file-one:v1' })
    expect(controller.getManagementSnapshot().history).toHaveLength(0)
  })
})
