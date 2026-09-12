import { describe, expect, it, vi } from 'vitest'
import { createOrdoSearchSource } from '../src/ordo-search-source.js'

describe('Ordo search owner source', () => {
  it('projects task metadata and opens only through the owner callback', async () => {
    const open = vi.fn()
    const source = createOrdoSearchSource({ snapshot: () => ({ state: 'ready', freshness: 'fresh', tasks: [{ ref: 'task:t1', title: 'Verify build', state: 'pending', kind: 'verification', summary: 'read only' }] }), open })
    const page = await source.search({ query: 'build', scope: { kind: 'workspace', ref: 'w1' }, kinds: ['verification'], filters: {}, sort: 'relevance' }, new AbortController().signal)
    expect(page.status).toBe('ready'); expect(page.resources).toHaveLength(1); expect(page.resources[0]).toMatchObject({ owner: 'ordo', ref: 'task:t1', kind: 'verification' })
    expect(await source.open?.(page.resources[0]!, { kind: 'workspace', ref: 'w1' })).toEqual({ status: 'opened' }); expect(open).toHaveBeenCalledOnce();
  })
  it('keeps denied owner state explicit and returns no results', async () => {
    const source = createOrdoSearchSource({ snapshot: () => ({ state: 'permission_denied', freshness: 'stale', tasks: [{ ref: 'task:t1', title: 'Hidden', state: 'done' }] }) })
    const page = await source.search({ query: '', scope: { kind: 'workspace', ref: 'w1' }, kinds: ['task'], filters: {}, sort: 'relevance' }, new AbortController().signal)
    expect(page).toMatchObject({ status: 'denied', resources: [] })
  })
})
