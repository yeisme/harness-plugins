import { describe, expect, it, vi } from 'vitest'
import { createSessionListConversationSearchHost, CURRENT_PROFILE_WORKSPACE_REF } from '../src/conversation-search-host.js'
import { searchSessionMetadata } from '../src/session-metadata-search.js'
import { createWorkspaceSearchHistoryAdapter } from '../src/search-adapter.js'
import { DEFAULT_SEARCH_CENTER_CONTROLS } from '../src/search-controls.js'
import { projectWorkspaceSearch } from '../src/search-group.js'
import type { WorkspaceSearchCandidateV1 } from '../src/search-identity.js'
import { activateWorkspaceSearchCandidate } from '../src/search-open.js'
import { PaneWorkbenchController } from '../src/controller.js'
import { PaneViewRegistry } from '../src/view-registry.js'

const request = { workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: 'Planning', limit: 2 }
const signal = () => new AbortController().signal

describe('complete session metadata filtering', () => {
  it('filters records beyond the old first page before paginating', async () => {
    const byId: Record<string, { displayTitle: string; updatedAt: string; running: boolean }> = {}
    for (let index = 0; index < 25; index++) byId[`s${index}`] = { displayTitle: `Planning ${index}`, updatedAt: '2025-01-01T00:00:00.000Z', running: false }
    byId.last = { displayTitle: 'Planning newest', updatedAt: '2026-09-10T00:00:00.000Z', running: true }
    const host = createSessionListConversationSearchHost({ list: { getSnapshot: () => ({ byId }) } })!
    const result = await searchSessionMetadata(host, request, { sort: 'updated', updatedSince: '2026-01-01T00:00:00.000Z', status: 'running' }, 'en', signal())
    expect(result.items.map(item => item.sessionRef)).toEqual(['last'])
    expect(result.nextCursor).toBeUndefined()
  })

  it('orders the complete snapshot by name, keeps concurrent query cursors, and rejects changed conditions', async () => {
    const byId = {
      c: { displayTitle: 'Planning 30' }, a: { displayTitle: 'Planning 1' }, b: { displayTitle: 'Planning 2' },
      other1: { displayTitle: 'Other 1' }, other2: { displayTitle: 'Other 2' }, other3: { displayTitle: 'Other 3' },
    }
    const host = createSessionListConversationSearchHost({ list: { getSnapshot: () => ({ byId }) } })!
    const first = await searchSessionMetadata(host, request, { sort: 'name' }, 'en', signal())
    expect(first.items.map(item => item.sessionRef)).toEqual(['a', 'b'])
    await searchSessionMetadata(host, { ...request, query: 'Other' }, { sort: 'name' }, 'en', signal())
    const second = await searchSessionMetadata(host, { ...request, cursor: first.nextCursor }, { sort: 'name' }, 'en', signal())
    expect(second.items.map(item => item.sessionRef)).toEqual(['c'])
    await expect(searchSessionMetadata(host, { ...request, cursor: first.nextCursor }, { sort: 'updated' }, 'en', signal())).resolves.toMatchObject({ status: 'contract_mismatch', reason: 'cursor_stale' })
    delete (byId as Record<string, unknown>).c
    await expect(searchSessionMetadata(host, { ...request, cursor: first.nextCursor }, { sort: 'name' }, 'en', signal())).resolves.toMatchObject({ status: 'contract_mismatch', reason: 'cursor_stale' })
  })

  it('keeps missing status or malformed dates unknown and rejects unsupported scope', async () => {
    const getSnapshot = vi.fn(() => ({ byId: {
      a: { displayTitle: 'Planning unknown' }, b: { displayTitle: 'Planning invalid', updatedAt: '2026-99-99T00:00:00Z' },
    } }))
    const host = createSessionListConversationSearchHost({ list: { getSnapshot } })!
    expect((await searchSessionMetadata(host, request, { sort: 'updated', updatedSince: '2026-01-01' }, 'en', signal())).items).toEqual([])
    expect((await searchSessionMetadata(host, request, { sort: 'relevance', status: 'idle' }, 'en', signal())).items).toEqual([])
    getSnapshot.mockClear()
    await expect(searchSessionMetadata(host, { ...request, workspaceRef: 'private-project' }, DEFAULT_SEARCH_CENTER_CONTROLS, 'en', signal())).resolves.toMatchObject({ status: 'contract_mismatch', reason: 'project_scope_unsupported' })
    expect(getSnapshot).not.toHaveBeenCalled()
  })
})

describe('source constraints and remote ranking', () => {
  it('preserves permission denial even when a malformed response also includes a foreign row', async () => {
    const adapter = createWorkspaceSearchHistoryAdapter({ workspaceContext: {
      getSnapshot: () => ({ workspaceRef: 'w1', revision: '1' }),
      listWorkspaces: () => [{ workspaceRef: 'w1', label: 'One' }],
      search: async () => ({ status: 'permission_denied', items: [{ workspaceRef: 'w2', ref: 'hidden', kind: 'session', source: 'history', title: 'Hidden' }] }),
    } })
    await expect(adapter.search({ query: '', allAccessibleProjects: true, limit: 20, locale: 'en' }, signal())).resolves.toMatchObject({ status: 'permission_denied', items: [] })
  })

  it('returns a workspace hit to its original owner and rechecks scope before opening', async () => {
    let allowed = true
    const item = { workspaceRef: 'w2', ref: 'other-tab', source: 'tab' as const, kind: 'editor', title: 'Other document' }
    const open = vi.fn()
    const workspaceContext = {
      getSnapshot: () => ({ workspaceRef: 'w1', revision: '1' }),
      listWorkspaces: () => allowed ? [{ workspaceRef: 'w2', label: 'Two' }] : [],
      search: vi.fn(async () => ({ items: [item], status: 'ready' as const })), open,
    }
    const adapter = createWorkspaceSearchHistoryAdapter({ workspaceContext })
    const page = await adapter.search({ query: 'document', allAccessibleProjects: true, limit: 20, locale: 'en' }, signal())
    const registry = new PaneViewRegistry({ capabilities: new Set() })
    const controller = new PaneWorkbenchController({ registry })
    const input = { candidate: page.items[0]!, registry, controller, workspaceContext }
    await expect(activateWorkspaceSearchCandidate(input)).resolves.toMatchObject({ ok: true })
    expect(open).toHaveBeenCalledWith(item)
    expect(Object.values(controller.getSnapshot().views)).toHaveLength(0)
    await expect(activateWorkspaceSearchCandidate({ ...input, placement: 'right' })).resolves.toMatchObject({ ok: false, reason: 'workspace_placement_unsupported' })
    allowed = false
    await expect(activateWorkspaceSearchCandidate(input)).resolves.toMatchObject({ ok: false, reason: 'project_unavailable' })
    expect(open).toHaveBeenCalledOnce()
  })

  it('does not filter an unknown remote first page and claim global sorting', async () => {
    const search = vi.fn(async () => ({ items: [], status: 'ready' as const }))
    const adapter = createWorkspaceSearchHistoryAdapter({ conversationSearch: { capability: 'pane.conversation-search.v1', search, open: vi.fn() } })
    await expect(adapter.search({ query: 'Planning', allAccessibleProjects: false, limit: 20, locale: 'en', controls: { sort: 'name' } }, signal())).resolves.toMatchObject({ status: 'contract_mismatch', reason: 'source_controls_unsupported' })
    expect(search).not.toHaveBeenCalled()
  })

  it('routes a scoped workspace query through its owner and refuses out-of-scope rows', async () => {
    const search = vi.fn(async () => ({ status: 'ready' as const, items: [{ workspaceRef: 'w2', ref: 's2', title: 'Other project', kind: 'session', source: 'history' as const }] }))
    const adapter = createWorkspaceSearchHistoryAdapter({ workspaceContext: {
      getSnapshot: () => ({ workspaceRef: 'w1', revision: '1' }),
      listWorkspaces: () => [{ workspaceRef: 'w1', label: 'One' }, { workspaceRef: 'w2', label: 'Two' }], search,
    } })
    const result = await adapter.search({ query: '', allAccessibleProjects: false, projectRef: 'w1', limit: 20, locale: 'en' }, signal())
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ workspaceRefs: ['w1'] }), expect.any(AbortSignal))
    expect(result).toMatchObject({ items: [], status: 'contract_mismatch', reason: 'source_scope_mismatch' })
  })

  it('preserves authoritative remote matches even when the bounded title and snippet omit the query', () => {
    const remote = (id: string): WorkspaceSearchCandidateV1 => ({
      kind: 'session', stableKey: id, title: `Result ${id}`, ownerRef: 'history', semanticIcon: 'message',
      openTarget: { type: 'session', owner: 'history', sessionRef: id }, availability: 'available',
      aliases: [], keywords: [], opened: false, recent: false, frequent: false, compatibility: false, sideEffect: false, openOnly: false, mergedCommandIds: [],
    })
    const projection = projectWorkspaceSearch({ query: 'authorized fulltext match', candidates: [], remoteItems: [remote('z'), remote('a')] })
    expect(projection.visibleItems.map(item => item.stableKey)).toEqual(['z', 'a'])
  })
})
