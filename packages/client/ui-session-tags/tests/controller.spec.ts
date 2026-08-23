import { describe, expect, it } from 'vitest'
import { createSessionTagsController } from '../src/client/controller.ts'
import type { SessionTagsListAnswerV1, SessionTagsRemoteFace, SessionTagsSetAnswerV1, SessionTagsSetInputV1 } from '../src/client/wire.ts'

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

/** 刷新一个宏任务：让单飞泵完成一次迭代起点的微任务让渡。 */
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

class FakeRemote implements SessionTagsRemoteFace {
  public listCalls = 0
  public pending: Array<Deferred<SessionTagsListAnswerV1>> = []
  public nextAnswer: SessionTagsListAnswerV1 = { ok: true, specVersion: '1.0', entries: [] }

  async list(): Promise<SessionTagsListAnswerV1> {
    this.listCalls += 1
    const d = deferred<SessionTagsListAnswerV1>()
    this.pending.push(d)
    return d.promise
  }

  async set(_input: SessionTagsSetInputV1): Promise<SessionTagsSetAnswerV1> {
    throw new Error('controller never calls set')
  }

  resolveAll(answer?: SessionTagsListAnswerV1): void {
    const target = answer ?? this.nextAnswer
    for (const d of this.pending.splice(0)) d.resolve(target)
  }
}

function row(sessionId: string, tags: string[], version = 'v1') {
  return { sessionId, row: { session: { createdAt: '2026-01-01T00:00:00.000Z' }, tags, version, updatedAt: 1 } }
}

describe('session-tags controller', () => {
  it('publishes ready snapshots from authoritative list answers', async () => {
    const remote = new FakeRemote()
    const controller = createSessionTagsController({ remote })
    const p = controller.refresh()
    expect(controller.getSnapshot().status).toBe('loading')
    await tick()
    remote.resolveAll({ ok: true, specVersion: '1.0', entries: [row('s1', ['a'])] })
    await p
    const state = controller.getSnapshot()
    expect(state).toMatchObject({ status: 'ready', specVersion: '1.0' })
    if (state.status === 'ready') {
      expect(state.entries.map(e => e.sessionId)).toEqual(['s1'])
    }
  })

  it('discards stale-generation answers arriving after a newer refresh', async () => {
    const remote = new FakeRemote()
    const controller = createSessionTagsController({ remote })
    const first = controller.refresh()
    await tick() // gen1 的读取已在途
    expect(remote.listCalls).toBe(1)
    const second = controller.refresh() // 连接 reset：gen2 取代 gen1
    await tick()
    // 旧 generation 的应答先到：必须被丢弃，不得覆盖新连接的 snapshot。
    remote.resolveAll({ ok: true, specVersion: '1.0', entries: [row('s1', ['stale'])] })
    await first
    expect(controller.getSnapshot().status).toBe('loading')
    expect(controller.getSnapshot()).not.toMatchObject({ entries: [row('s1', ['stale'])] })
    // 泵继续服务 gen2。
    await tick()
    expect(remote.listCalls).toBe(2)
    remote.resolveAll({ ok: true, specVersion: '1.0', entries: [row('s2', ['fresh'])] })
    await second
    const state = controller.getSnapshot()
    expect(state.status).toBe('ready')
    if (state.status === 'ready') {
      expect(state.entries.map(e => e.sessionId)).toEqual(['s2'])
    }
  })

  it('folds concurrent refreshes into a single in-flight list call', async () => {
    const remote = new FakeRemote()
    const controller = createSessionTagsController({ remote })
    void controller.refresh()
    await tick()
    remote.resolveAll({ ok: true, specVersion: '1.0', entries: [] })
    await tick()
    // 第一轮完成后，泵不再运行。
    expect(remote.listCalls).toBe(1)
    // 立即连续触发三种刷新源：合并为一次读。
    const a = controller.onConnectionReset()
    const b = controller.onWindowFocus()
    const c = controller.afterOwnWrite()
    await tick()
    expect(remote.listCalls).toBe(2) // 单飞：三次触发只补读一次
    remote.resolveAll({ ok: true, specVersion: '1.0', entries: [row('s9', ['x'])] })
    await Promise.all([a, b, c])
    expect(controller.getSnapshot().status).toBe('ready')
  })

  it('never fabricates tags in error states', async () => {
    const remote = new FakeRemote()
    const controller = createSessionTagsController({ remote })
    const first = controller.refresh()
    await tick()
    remote.resolveAll({ ok: true, specVersion: '1.0', entries: [row('s1', ['a'])] })
    await first
    const second = controller.refresh()
    await tick()
    remote.resolveAll({ ok: false, code: 'storage-unavailable', message: 'offline' })
    await second
    const state = controller.getSnapshot()
    expect(state).toMatchObject({ status: 'error', message: 'offline' })
    expect('entries' in state).toBe(false)
  })

  it('maps remote exceptions to error state', async () => {
    const remote = new FakeRemote()
    remote.list = async () => { throw new TypeError('carrier dropped') }
    const controller = createSessionTagsController({ remote })
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', message: 'carrier dropped' })
  })

  it('ignores answers and clears listeners after dispose', async () => {
    const remote = new FakeRemote()
    const controller = createSessionTagsController({ remote })
    let notified = 0
    controller.subscribe(() => { notified += 1 })
    const p = controller.refresh()
    controller.dispose()
    remote.resolveAll({ ok: true, specVersion: '1.0', entries: [row('s1', ['late'])] })
    await p
    expect(controller.getSnapshot()).toMatchObject({ status: 'idle' })
    expect(notified).toBe(1) // loading 通知一次；dispose 后的应答不再通知
    await controller.refresh() // no-op
    expect(remote.listCalls).toBe(1)
  })

  it('keeps snapshot references stable between notifications', async () => {
    const remote = new FakeRemote()
    const controller = createSessionTagsController({ remote })
    const seen: string[] = []
    controller.subscribe(() => { seen.push(controller.getSnapshot().status) })
    const p = controller.refresh()
    await tick()
    remote.resolveAll({ ok: true, specVersion: '1.0', entries: [row('s1', ['a'])] })
    await p
    const after = controller.getSnapshot()
    expect(controller.getSnapshot()).toBe(after)
    expect(seen).toEqual(['loading', 'ready'])
  })

  it('rowOf finds a tagged session and returns undefined otherwise', async () => {
    const remote = new FakeRemote()
    const controller = createSessionTagsController({ remote })
    const p = controller.refresh()
    await tick()
    remote.resolveAll({ ok: true, specVersion: '1.0', entries: [row('s1', ['a'])] })
    await p
    expect(controller.rowOf('s1')?.row.tags).toEqual(['a'])
    expect(controller.rowOf('s2')).toBeUndefined()
    expect(controller.isReady()).toBe(true)
  })
})
