import { describe, expect, it, vi } from 'vitest'
import { SessionUrlSyncController } from '../src/index.ts'

describe('SessionUrlSyncController', () => {
  it('opens a URL session and pushes canonical history', async () => {
    const pushState = vi.fn()
    const openSession = vi.fn(async () => true)
    const controller = new SessionUrlSyncController({ listSessions: async () => [{ sessionId: 'abc' }], openSession }, { origin: 'http://127.0.0.1:3000', history: { pushState, replaceState: vi.fn() }, hasHistoryFallback: true })
    await controller.boot({ pathname: '/s/abc', search: '' })
    expect(openSession).toHaveBeenCalledWith('abc')
    expect(pushState).toHaveBeenCalledWith({}, '', 'http://127.0.0.1:3000/s/abc')
    expect(controller.getSnapshot()).toEqual({ phase: 'ready', sessionId: 'abc' })
  })

  it('reports missing sessions and discards stale generations', async () => {
    const resolvers: Array<(rows: readonly { sessionId: string }[]) => void> = []
    const listSessions = vi.fn(() => new Promise<readonly { sessionId: string }[]>(resolve => { resolvers.push(resolve) }))
    const controller = new SessionUrlSyncController({ listSessions, openSession: async () => true })
    const first = controller.select('old')
    const second = controller.select('new')
    resolvers[1]!([{ sessionId: 'new' }])
    await second
    resolvers[0]!([{ sessionId: 'old' }])
    await first
    expect(controller.getSnapshot()).toEqual({ phase: 'ready', sessionId: 'new' })
  })
})

describe('controller extensions (§3.1/§3.2/§3.3)', () => {
  function historyRecorder() {
    const ops: string[] = []
    const history = {
      pushState: (..._args: never[]) => { ops.push('push') },
      replaceState: (..._args: never[]) => { ops.push('replace') },
    }
    return { ops, history: history as unknown as History }
  }

  it('notifies subscribers on every state transition', async () => {
    const controller = new SessionUrlSyncController(
      { listSessions: async () => [{ sessionId: 'sess-a' }], openSession: async () => undefined },
      {},
    )
    const seen: string[] = []
    const unsubscribe = controller.subscribe(() => { seen.push(controller.getSnapshot().phase) })
    await controller.boot({ pathname: '/', search: '?s=sess-a' })
    expect(seen).toEqual(['loading', 'ready'])
    unsubscribe()
  })

  it('syncFromSelection pushes the canonical URL without re-opening the session', () => {
    const open = vi.fn()
    const controller = new SessionUrlSyncController(
      { listSessions: async () => [{ sessionId: 'sess-a' }], openSession: open },
      { history: historyRecorder().history, origin: 'http://127.0.0.1:3080' },
    )
    controller.syncFromSelection('sess-a')
    expect(controller.getSnapshot()).toMatchObject({ phase: 'ready', sessionId: 'sess-a' })
    expect(open).not.toHaveBeenCalled()
  })

  it('syncFromSelection ignores identical, empty, and invalid ids', () => {
    const controller = new SessionUrlSyncController(
      { listSessions: async () => [], openSession: async () => undefined },
      { history: historyRecorder().history, origin: 'http://127.0.0.1:3080' },
    )
    controller.syncFromSelection('sess-a')
    controller.syncFromSelection('sess-a') // same id: no-op
    controller.syncFromSelection(undefined)
    controller.syncFromSelection('../escape')
    expect(controller.getSnapshot()).toMatchObject({ phase: 'ready', sessionId: 'sess-a' })
  })

  it('select with history source never writes history (popstate reverse path)', async () => {
    const recorder = historyRecorder()
    const controller = new SessionUrlSyncController(
      { listSessions: async () => [{ sessionId: 'sess-a' }, { sessionId: 'sess-b' }], openSession: async () => undefined },
      { history: recorder.history, origin: 'http://127.0.0.1:3080' },
    )
    await controller.select('sess-a', 'url')
    expect(recorder.ops).toEqual(['push'])
    await controller.select('sess-b', 'history')
    expect(recorder.ops).toEqual(['push'])
    expect(controller.getSnapshot()).toMatchObject({ phase: 'ready', sessionId: 'sess-b' })
  })

  it('same-id reselection uses replaceState to avoid history spam', async () => {
    const recorder = historyRecorder()
    const controller = new SessionUrlSyncController(
      { listSessions: async () => [{ sessionId: 'sess-a' }], openSession: async () => undefined },
      { history: recorder.history, origin: 'http://127.0.0.1:3080' },
    )
    await controller.select('sess-a', 'url')
    await controller.select('sess-a', 'user')
    expect(recorder.ops).toEqual(['push', 'replace'])
  })

  it('dismissMissing replaces the URL back to the root and returns to idle', async () => {
    const replaced: string[] = []
    const history = {
      pushState: (..._args: never[]) => {},
      replaceState: (_state: unknown, _title: unknown, url: string) => { replaced.push(String(url)) },
    }
    const controller = new SessionUrlSyncController(
      { listSessions: async () => [], openSession: async () => undefined },
      { history: history as unknown as History, origin: 'http://127.0.0.1:3080' },
    )
    await controller.boot({ pathname: '/', search: '?s=sess-gone' })
    expect(controller.getSnapshot().phase).toBe('missing')
    controller.dismissMissing()
    expect(replaced).toEqual(['http://127.0.0.1:3080/'])
    expect(controller.getSnapshot().phase).toBe('idle')
  })

  it('generation token drops a stale boot answer', async () => {
    const pending: Array<(rows: readonly { sessionId: string }[]) => void> = []
    const controller = new SessionUrlSyncController(
      {
        listSessions: () => new Promise(resolve => { pending.push(resolve) }),
        openSession: async () => undefined,
      },
      {},
    )
    const first = controller.boot({ pathname: '/', search: '?s=sess-a' })
    const second = controller.boot({ pathname: '/', search: '?s=sess-b' })
    pending[1]!([{ sessionId: 'sess-b' }])
    await second
    pending[0]!([{ sessionId: 'sess-a' }]) // 过期应答：generation 不符，必须丢弃
    await first
    expect(controller.getSnapshot()).toMatchObject({ phase: 'ready', sessionId: 'sess-b' })
  })
})
