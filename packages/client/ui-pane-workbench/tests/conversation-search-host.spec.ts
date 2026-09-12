import { describe, expect, it, vi } from 'vitest'
import {
  createSessionListConversationSearchHost,
  CURRENT_PROFILE_WORKSPACE_REF,
  PANE_CONVERSATION_SEARCH_CAPABILITY,
  probeSessionListSearchSeam,
  resolvePaneConversationSearchHost,
} from '../src/conversation-search-host.js'
import { PANE_CONVERSATION_SEARCH_CONTEXT_KEY, type PaneConversationSearchHostV1 } from '../src/management.js'
import { createWorkspaceSearchHistoryAdapter } from '../src/search-adapter.js'
import { probeWorkspaceSearchHistoryAdapter } from '../src/search-query.js'

function sessionsFace(input: {
  readonly ids?: readonly string[]
  readonly byId?: Record<string, { displayTitle?: string; running?: boolean; updatedAt?: number | string }>
  readonly open?: (sessionId: string) => void
  readonly list?: unknown
}): unknown {
  return {
    list: input.list ?? {
      getSnapshot: () => ({
        ids: input.ids ?? Object.keys(input.byId ?? {}),
        byId: input.byId ?? {},
        current: input.ids?.[0],
      }),
      subscribe: () => () => {},
    },
    ...(input.open === undefined ? {} : { open: input.open }),
  }
}

describe('session-list conversation search probe', () => {
  it('keeps unavailable when the sessions.list seam is missing', () => {
    expect(probeSessionListSearchSeam(undefined)).toEqual({ available: false, reason: 'sessions_list_unavailable' })
    expect(probeSessionListSearchSeam({})).toEqual({ available: false, reason: 'sessions_list_unavailable' })
    expect(probeSessionListSearchSeam({ list: {} })).toEqual({ available: false, reason: 'sessions_list_unavailable' })
    expect(createSessionListConversationSearchHost(undefined)).toBeUndefined()
    expect(resolvePaneConversationSearchHost({ get: () => undefined })).toBeUndefined()
  })

  it('is available with an empty current-profile list', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({ ids: [], byId: {} }))
    expect(host?.capability).toBe(PANE_CONVERSATION_SEARCH_CAPABILITY)
    expect(probeWorkspaceSearchHistoryAdapter({ search: host?.search, capability: host?.capability })).toMatchObject({ capability: 'available' })
    await expect(host!.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: 'anything', limit: 20 })).resolves.toEqual({
      items: [],
      status: 'ready',
    })
  })

  it('records contract_mismatch when search is not callable', () => {
    expect(probeWorkspaceSearchHistoryAdapter({ search: 'nope', capability: PANE_CONVERSATION_SEARCH_CAPABILITY })).toMatchObject({
      capability: 'contract_mismatch',
      reason: 'history_search_not_callable',
    })
    const adapter = createWorkspaceSearchHistoryAdapter({
      conversationSearch: { capability: PANE_CONVERSATION_SEARCH_CAPABILITY, search: 'nope' as never, open: vi.fn() },
    })
    expect(adapter.capability).toBe('contract_mismatch')
  })
})

describe('session-list conversation search host', () => {
  const rows = {
    'session:alpha': { displayTitle: 'Alpha planning', running: false, updatedAt: 1_725_000_000_000 },
    'session:beta': { displayTitle: 'Beta review', running: true, updatedAt: '2026-09-06T12:00:00.000Z' },
    'session:gamma': { displayTitle: 'Gamma notes', running: false },
  }

  it('filters the current snapshot by displayTitle and session id', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({ ids: Object.keys(rows), byId: rows }))!
    const byTitle = await host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: 'beta', limit: 20 })
    expect(byTitle.status).toBe('ready')
    expect(byTitle.items.map(item => item.sessionRef)).toEqual(['session:beta'])
    expect(byTitle.items[0]).toMatchObject({ title: 'Beta review', snippet: 'Beta review', messageRef: 'session:beta' })
    const byId = await host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: 'session:gamma', limit: 20 })
    expect(byId.items.map(item => item.sessionRef)).toEqual(['session:gamma'])
  })

  it('rejects a project scope that the current-profile snapshot cannot establish', async () => {
    const getSnapshot = vi.fn(() => ({ ids: Object.keys(rows), byId: rows }))
    const host = createSessionListConversationSearchHost({ list: { getSnapshot } })!
    await expect(host.search({ workspaceRef: 'workspace:project-a', query: '', limit: 20 })).resolves.toEqual({
      items: [], status: 'contract_mismatch', reason: 'project_scope_unsupported',
    })
    expect(getSnapshot).not.toHaveBeenCalled()
  })

  it('restricts a session-addressed request to that session', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({ byId: rows }))!
    const page = await host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, sessionRef: 'session:beta', query: '', limit: 20 })
    expect(page.items.map(item => item.sessionRef)).toEqual(['session:beta'])
  })

  it('rejects malformed legacy cursors without interpreting a numeric prefix', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({ byId: rows }))!
    for (const cursor of ['s:2junk', 's:1.5', 's:-1', 's:9007199254740993']) {
      await expect(host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: '', limit: 2, cursor })).resolves.toMatchObject({ status: 'contract_mismatch', reason: 'invalid_cursor' })
    }
  })

  it('does not report a missing open seam or a removed session as a successful navigation', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({ byId: rows }))!
    const page = await host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: 'beta', limit: 20 })
    await expect(Promise.resolve().then(() => host.open(page.items[0]!))).rejects.toThrow('session_open_unavailable')
    const open = vi.fn()
    const liveRows = { ...rows }
    const live = createSessionListConversationSearchHost({ list: { getSnapshot: () => ({ byId: liveRows }) }, open })!
    delete (liveRows as Record<string, unknown>)['session:beta']
    await expect(Promise.resolve().then(() => live.open(page.items[0]!))).rejects.toThrow('session_unavailable')
    expect(open).not.toHaveBeenCalled()
  })

  it('propagates an asynchronous owner open failure', async () => {
    const host = createSessionListConversationSearchHost({
      list: { getSnapshot: () => ({ byId: rows }) },
      open: vi.fn(async () => { throw new Error('navigation_failed') }),
    })!
    const page = await host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: 'beta', limit: 20 })
    await expect(host.open(page.items[0]!)).rejects.toThrow('navigation_failed')
  })

  it('paginates with an opaque cursor', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({ ids: Object.keys(rows), byId: rows }))!
    const first = await host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: '', limit: 2 })
    expect(first.items.map(item => item.sessionRef)).toEqual(['session:alpha', 'session:beta'])
    expect(first.nextCursor).toBe('s:2')
    const second = await host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: '', limit: 2, cursor: first.nextCursor })
    expect(second.items.map(item => item.sessionRef)).toEqual(['session:gamma'])
    expect(second.nextCursor).toBeUndefined()
    await expect(host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: '', limit: 2, cursor: 'raw' })).resolves.toMatchObject({
      status: 'contract_mismatch',
      reason: 'invalid_cursor',
    })
  })

  it('honors AbortSignal without returning a page', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({ ids: Object.keys(rows), byId: rows }))!
    const abort = new AbortController()
    abort.abort()
    await expect(host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: 'alpha', limit: 20 }, abort.signal)).resolves.toEqual({
      items: [],
      status: 'offline',
      reason: 'aborted',
    })
  })

  it('opens through official sessions.open and does not invent navigation', async () => {
    const open = vi.fn()
    const host = createSessionListConversationSearchHost(sessionsFace({ ids: ['session:beta'], byId: rows, open }))!
    const page = await host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: 'beta', limit: 20 })
    await host.open(page.items[0]!)
    expect(open).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith('session:beta')
  })

  it('does not leak HTML, paths, or tokens in snippets', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({
      ids: ['session:safe', 'session:html', 'session:path', 'session:token'],
      byId: {
        'session:safe': { displayTitle: 'Safe title' },
        'session:html': { displayTitle: '<img src=x onerror=alert(1)> leaked' },
        'session:path': { displayTitle: '/etc/passwd secret' },
        'session:token': { displayTitle: 'bearer abcdefghijklmnopqrstuvwxyz012345' },
      },
    }))!
    const page = await host.search({ workspaceRef: CURRENT_PROFILE_WORKSPACE_REF, query: '', limit: 20 })
    const serialized = JSON.stringify(page.items)
    expect(serialized).not.toContain('<img')
    expect(serialized).not.toContain('onerror')
    expect(serialized).not.toContain('/etc/passwd')
    expect(serialized).not.toContain('bearer abcdefghijklmnopqrstuvwxyz012345')
    expect(page.items.find(item => item.sessionRef === 'session:html')?.snippet).toBe('leaked')
    expect(page.items.find(item => item.sessionRef === 'session:path')?.snippet).toBe('session:path')
    expect(page.items.find(item => item.sessionRef === 'session:token')?.snippet).toBe('session:token')
    expect(page.items.find(item => item.sessionRef === 'session:safe')?.snippet).toBe('Safe title')
  })
})

describe('workspace search history adapter over session-list host', () => {
  it('keeps metadata-only hits free of invented project and message anchors', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({ byId: { s1: { displayTitle: 'Planning' } } }))!
    const adapter = createWorkspaceSearchHistoryAdapter({ conversationSearch: host })
    const page = await adapter.search({ query: 'Planning', allAccessibleProjects: true, limit: 20, locale: 'en' }, new AbortController().signal)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.projectRef).toBeUndefined()
    expect(page.items[0]?.messageRef).toBeUndefined()
    expect(page.items[0]?.openTarget.messageRef).toBeUndefined()
  })

  it('does not silently truncate an authorized aggregate workspace request to three projects', async () => {
    const refs = ['w1', 'w2', 'w3', 'w4', 'w5']
    const search = vi.fn(async () => ({ items: [], status: 'ready' as const }))
    const adapter = createWorkspaceSearchHistoryAdapter({ workspaceContext: {
      getSnapshot: () => ({ workspaceRef: 'w1', revision: '1' }),
      listWorkspaces: () => refs.map(workspaceRef => ({ workspaceRef, label: workspaceRef })),
      search,
    } })
    await adapter.search({ query: 'test', allAccessibleProjects: true, limit: 20, locale: 'en' }, new AbortController().signal)
    expect(search).toHaveBeenCalledOnce()
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ workspaceRefs: refs }), expect.any(AbortSignal))
  })

  it('maps an empty current-profile snapshot as available, not unavailable', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({ ids: [], byId: {} }))!
    const adapter = createWorkspaceSearchHistoryAdapter({ conversationSearch: host })
    expect(adapter.capability).toBe('available')
    await expect(adapter.search({ query: 'alpha', allAccessibleProjects: false, limit: 20, locale: 'en' }, new AbortController().signal)).resolves.toMatchObject({
      items: [],
      status: 'ready',
    })
  })

  it('returns current-profile hits without a workspace owner', async () => {
    const host = createSessionListConversationSearchHost(sessionsFace({
      ids: ['session:alpha'],
      byId: { 'session:alpha': { displayTitle: 'Alpha planning' } },
    }))!
    const adapter = createWorkspaceSearchHistoryAdapter({ conversationSearch: host })
    const page = await adapter.search({ query: 'planning', allAccessibleProjects: false, limit: 20, locale: 'en' }, new AbortController().signal)
    expect(page.status).toBe('ready')
    expect(page.items).toHaveLength(1)
    expect(page.items[0]).toMatchObject({
      kind: 'session',
      title: 'Alpha planning',
      openTarget: { type: 'session', sessionRef: 'session:alpha' },
    })
  })
})

describe('conversation search host injection', () => {
  it('does not override an owner-provided host', () => {
    const owner: PaneConversationSearchHostV1 = {
      capability: PANE_CONVERSATION_SEARCH_CAPABILITY,
      search: vi.fn(async () => ({ items: [], status: 'ready' })),
      open: vi.fn(),
    }
    const sessions = sessionsFace({
      ids: ['session:alpha'],
      byId: { 'session:alpha': { displayTitle: 'Alpha' } },
    })
    const resolved = resolvePaneConversationSearchHost({
      get: (name: string) => name === PANE_CONVERSATION_SEARCH_CONTEXT_KEY ? owner : name === 'sessions' ? sessions : undefined,
    })
    expect(resolved).toBe(owner)
  })

  it('injects the session-list host when the owner key is absent', () => {
    const sessions = sessionsFace({
      ids: ['session:alpha'],
      byId: { 'session:alpha': { displayTitle: 'Alpha' } },
    })
    const resolved = resolvePaneConversationSearchHost({
      get: (name: string) => name === 'sessions' ? sessions : undefined,
    })
    expect(resolved?.capability).toBe(PANE_CONVERSATION_SEARCH_CAPABILITY)
    expect(typeof resolved?.search).toBe('function')
  })
})
