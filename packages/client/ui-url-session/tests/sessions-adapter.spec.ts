// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createSessionsAdapter, probeUrlSessionSeams, type SessionsServiceLike } from '../src/sessions-adapter.ts'

function serviceOf(overrides: Partial<SessionsServiceLike> = {}): SessionsServiceLike {
  return {
    list: { getSnapshot: () => ({ current: 'sess-a', ids: ['sess-a', 'sess-b'], byId: { 'sess-a': {}, 'sess-b': {} } }), subscribe: () => () => {} },
    open: vi.fn(),
    ...overrides,
  } as SessionsServiceLike
}

describe('probeUrlSessionSeams (§3.1 capability probe)', () => {
  it('reports available when list snapshot and open are present', () => {
    const probe = probeUrlSessionSeams({ get: () => serviceOf() })
    expect(probe.available).toBe(true)
    expect(probe.service).toBeDefined()
  })

  it('reports unavailable with reasons for each missing face', () => {
    expect(probeUrlSessionSeams({ get: () => undefined }).reason).toContain('sessions service is unavailable')
    expect(probeUrlSessionSeams({ get: () => ({ open: vi.fn() }) }).reason).toContain('list snapshot')
    expect(probeUrlSessionSeams({ get: () => ({ list: { getSnapshot: () => ({}) } }) }).reason).toContain('sessions open')
  })

  it('does not throw when the service read itself rejects', () => {
    const probe = probeUrlSessionSeams({ get: () => { throw new Error('missing') } })
    expect(probe.available).toBe(false)
    expect(probe.service).toBeUndefined()
  })
})

describe('createSessionsAdapter', () => {
  it('lists sessions from the byId snapshot and opens through the service', async () => {
    const service = serviceOf()
    const adapter = createSessionsAdapter(service)
    const rows = await adapter.listSessions()
    expect(rows.map(row => row.sessionId).sort()).toEqual(['sess-a', 'sess-b'])
    await adapter.openSession('sess-b')
    expect(service.open).toHaveBeenCalledWith('sess-b')
  })

  it('falls back to the ids array when byId is absent', async () => {
    const adapter = createSessionsAdapter(serviceOf({
      list: { getSnapshot: () => ({ current: undefined, ids: ['only-a'] }) },
    }))
    expect(await adapter.listSessions()).toEqual([{ sessionId: 'only-a' }])
  })
})
