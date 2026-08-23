import { describe, expect, it } from 'vitest'
import { createSessionTagsSidecar, type SessionTagsTablePort } from '../src/service.ts'
import type { SessionTagRowV1, SessionTagSessionIdentityV1 } from '../src/wire.ts'

interface TestSession {
  readonly id: string
  readonly createdAt: number
  readonly cwd?: string
}

/** 内存版持久层：模拟 storage-domain 的 durability-before-memory（写完才可见）。 */
class MemoryTable implements SessionTagsTablePort {
  private readonly rows = new Map<string, SessionTagRowV1>()
  public putShouldFail = false

  get(key: string): SessionTagRowV1 | undefined {
    return this.rows.get(key)
  }

  entries(): IterableIterator<[string, SessionTagRowV1]> {
    return this.rows.entries()
  }

  async put(key: string, row: SessionTagRowV1): Promise<void> {
    if (this.putShouldFail) throw new Error('backend write failed')
    this.rows.set(key, row)
  }

  async delete(key: string): Promise<boolean> {
    return this.rows.delete(key)
  }
}

class FakePersistence {
  public sessions = new Map<string, TestSession>()
  public listCalls = 0

  async list(): Promise<TestSession[]> {
    this.listCalls += 1
    return [...this.sessions.values()]
  }
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function identityOf(session: TestSession): SessionTagSessionIdentityV1 {
  return { createdAt: iso(session.createdAt), ...(session.cwd === undefined ? {} : { cwd: session.cwd }) }
}

interface Harness {
  readonly table: MemoryTable
  readonly persistence: FakePersistence
  readonly sidecar: ReturnType<typeof createSessionTagsSidecar>
  /** 重建 sidecar（模拟 Host 重启后重新打开同一 domain）。 */
  restart(): void
}

function createHarness(): Harness {
  const table = new MemoryTable()
  const persistence = new FakePersistence()
  let sidecar = createSessionTagsSidecar({
    table,
    identity: {
      async inspectIdentity(sessionId) {
        const session = persistence.sessions.get(sessionId)
        return session === undefined ? undefined : identityOf(session)
      },
    },
    newVersion: (() => {
      let n = 0
      return () => `v${(n += 1)}`
    })(),
  })
  return {
    table,
    persistence,
    get sidecar() {
      return sidecar
    },
    restart() {
      sidecar = createSessionTagsSidecar({
        table,
        identity: {
          async inspectIdentity(sessionId) {
            const session = persistence.sessions.get(sessionId)
            return session === undefined ? undefined : identityOf(session)
          },
        },
        newVersion: (() => {
          let n = 100
          return () => `v${(n += 1)}`
        })(),
      })
    },
  }
}

describe('session-tags sidecar storage and CAS', () => {
  it('creates a row on first set with ifVersion null and returns durable-consistent state', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1000, cwd: '/w' })
    const result = await h.sidecar.set({ sessionId: 's1', tags: [' 工作 ', 'research'], ifVersion: null })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tags).toEqual(['工作', 'research'])
    expect(result.row?.version).toMatch(/^v\d+$/)
    expect(result.row?.session).toEqual({ createdAt: iso(1000), cwd: '/w' })
    expect(h.table.get('s1')).toBe(result.row)
  })

  it('recovers rows after a host restart against the same storage', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1000 })
    await h.sidecar.set({ sessionId: 's1', tags: ['keep'], ifVersion: null })
    h.restart()
    const listed = await h.sidecar.list()
    expect(listed.ok).toBe(true)
    if (!listed.ok) return
    expect(listed.entries.map(e => e.row.tags)).toEqual([['keep']])
    expect(listed.entries[0]?.row.version).toBe('v1')
  })

  it('hides rows whose session lifecycle identity no longer matches', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1000 })
    await h.sidecar.set({ sessionId: 's1', tags: ['old'], ifVersion: null })
    // SessionId 被新生命周期复用：createdAt 变化 → 旧行 stale。
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 999_999 })
    const listed = await h.sidecar.list()
    expect(listed.ok && listed.entries).toEqual([])
    // stale 行对 CAS 视为“无行”：非 null 的 ifVersion 冲突且权威行为空。
    const staleConflict = await h.sidecar.set({ sessionId: 's1', tags: ['x'], ifVersion: 'v1' })
    expect(staleConflict).toMatchObject({ ok: false, code: 'version-conflict', row: null })
    // 新生命周期可从空态重建绑定（ifVersion null），且不继承旧标签。
    const rebound = await h.sidecar.set({ sessionId: 's1', tags: ['new'], ifVersion: null })
    expect(rebound.ok && rebound.tags).toEqual(['new'])
    // 重建后的行是活的：错误版本冲突时返回该权威行。
    const liveConflict = await h.sidecar.set({ sessionId: 's1', tags: ['x'], ifVersion: 'v1' })
    expect(liveConflict).toMatchObject({ ok: false, code: 'version-conflict' })
    if (!liveConflict.ok && liveConflict.code === 'version-conflict') {
      expect(liveConflict.row?.tags).toEqual(['new'])
    }
  })

  it('returns session-not-found without touching storage for unknown or deleted sessions', async () => {
    const h = createHarness()
    const result = await h.sidecar.set({ sessionId: 'ghost', tags: ['a'], ifVersion: null })
    expect(result).toMatchObject({ ok: false, code: 'session-not-found' })
    expect([...h.table.entries()].length).toBe(0)
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1 })
    await h.sidecar.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    h.persistence.sessions.delete('s1')
    const afterDelete = await h.sidecar.set({ sessionId: 's1', tags: ['b'], ifVersion: 'v1' })
    expect(afterDelete).toMatchObject({ ok: false, code: 'session-not-found' })
    // 旧行保留（重装/恢复语义），但对 list 不可见。
    const listed = await h.sidecar.list()
    expect(listed.ok && listed.entries).toEqual([])
  })

  it('rejects invalid tag payloads and keeps the old row and version intact', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1 })
    const first = await h.sidecar.set({ sessionId: 's1', tags: ['good'], ifVersion: null })
    const bad = await h.sidecar.set({ sessionId: 's1', tags: ['', String.fromCharCode(3), 'a'.repeat(65)], ifVersion: first.ok ? first.row?.version ?? null : null })
    expect(bad).toMatchObject({ ok: false, code: 'tags-invalid' })
    if (!bad.ok && bad.code === 'tags-invalid') {
      expect(bad.reasons).toEqual(expect.arrayContaining(['empty', 'control-character', 'too-long']))
    }
    const unchanged = h.table.get('s1')
    expect(unchanged?.tags).toEqual(['good'])
    expect(unchanged?.version).toBe(first.ok ? first.row?.version : undefined)
  })

  it('returns version-conflict with the authoritative row and never overwrites concurrent writes', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1 })
    const first = await h.sidecar.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    expect(first.ok).toBe(true)
    const row = first.ok ? first.row : undefined
    const conflict = await h.sidecar.set({ sessionId: 's1', tags: ['b'], ifVersion: null })
    expect(conflict).toMatchObject({ ok: false, code: 'version-conflict' })
    if (!conflict.ok && conflict.code === 'version-conflict') {
      expect(conflict.row).toBe(row)
    }
    expect(h.table.get('s1')?.tags).toEqual(['a'])
  })

  it('treats a material-equal write as a no-op: same row, version, and updatedAt', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1 })
    const first = await h.sidecar.set({ sessionId: 's1', tags: ['a', 'b'], ifVersion: null })
    expect(first.ok).toBe(true)
    const before = h.table.get('s1')
    await new Promise(r => setTimeout(r, 2))
    const noop = await h.sidecar.set({
      sessionId: 's1',
      tags: [' a ', 'b'],
      ifVersion: first.ok ? first.row?.version ?? null : null,
    })
    expect(noop.ok).toBe(true)
    if (noop.ok) {
      expect(noop.row?.version).toBe(before?.version)
      expect(noop.row?.updatedAt).toBe(before?.updatedAt)
    }
    expect(h.table.get('s1')).toBe(before)
  })

  it('deletes the row when clearing all tags with a matching version', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1 })
    const first = await h.sidecar.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    const cleared = await h.sidecar.set({ sessionId: 's1', tags: [], ifVersion: first.ok ? first.row?.version ?? null : null })
    expect(cleared).toMatchObject({ ok: true, tags: [], row: null })
    expect(h.table.get('s1')).toBeUndefined()
    const listed = await h.sidecar.list()
    expect(listed.ok && listed.entries).toEqual([])
  })

  it('recreates after clear with ifVersion null', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1 })
    const first = await h.sidecar.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    await h.sidecar.set({ sessionId: 's1', tags: [], ifVersion: first.ok ? first.row?.version ?? null : null })
    const recreated = await h.sidecar.set({ sessionId: 's1', tags: ['b'], ifVersion: null })
    expect(recreated.ok && recreated.tags).toEqual(['b'])
  })

  it('serializes same-session writes through the row queue (no lost CAS state)', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1 })
    h.persistence.sessions.set('s2', { id: 's2', createdAt: 2 })
    const a = h.sidecar.set({ sessionId: 's1', tags: ['a1'], ifVersion: null })
    const b = h.sidecar.set({ sessionId: 's1', tags: ['b1'], ifVersion: null })
    const c = h.sidecar.set({ sessionId: 's2', tags: ['c1'], ifVersion: null })
    const [ra, rb, rc] = await Promise.all([a, b, c])
    expect(ra.ok).toBe(true)
    expect(rb).toMatchObject({ ok: false, code: 'version-conflict' }) // 同行第二个 null 写入按序看到已存在行
    expect(rc.ok).toBe(true)
    expect(h.table.get('s1')?.tags).toEqual(['a1'])
  })

  it('folds backend failures into storage-unavailable without mutating durable state', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1 })
    h.table.putShouldFail = true
    const failed = await h.sidecar.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    expect(failed).toMatchObject({ ok: false, code: 'storage-unavailable' })
    h.table.putShouldFail = false
    // 存储恢复后可重试（由调用方显式发起，服务端绝不自动重试）。
    const ok = await h.sidecar.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    expect(ok.ok).toBe(true)
  })

  it('list folds identity-reader failures into storage-unavailable', async () => {
    const table = new MemoryTable()
    let identityFails = false
    const seed = createSessionTagsSidecar({
      table,
      identity: {
        async inspectIdentity(sessionId: string) {
          return { createdAt: new Date(1).toISOString() }
        },
      },
      newVersion: () => 'seed',
    })
    // 先落一行，让 list 有需要核对身份的行。
    await seed.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    const sidecar = createSessionTagsSidecar({
      table,
      identity: {
        async inspectIdentity() {
          if (identityFails) throw new Error('persistence offline')
          return { createdAt: new Date(1).toISOString() }
        },
      },
    })
    identityFails = true
    const result = await sidecar.list()
    expect(result).toMatchObject({ ok: false, code: 'storage-unavailable' })
  })

  it('freezes returned rows and list snapshots', async () => {
    const h = createHarness()
    h.persistence.sessions.set('s1', { id: 's1', createdAt: 1 })
    const first = await h.sidecar.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    const listed = await h.sidecar.list()
    expect(Object.isFrozen(listed.ok ? listed.entries : [])).toBe(true)
    if (first.ok && first.row) {
      expect(Object.isFrozen(first.row)).toBe(true)
      expect(Object.isFrozen(first.row.session)).toBe(true)
    }
  })
})
