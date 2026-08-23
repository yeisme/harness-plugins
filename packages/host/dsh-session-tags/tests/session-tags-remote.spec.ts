import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  SESSION_TAGS_DOMAIN,
  SESSION_TAGS_REMOTE_SERVICE_KEY,
  SESSION_TAGS_SPEC_VERSION,
  SessionTagsRemoteService,
  apply,
  createSessionTagsSidecar,
  inject,
  name,
  sessionTagsDomainSpec,
  sessionTagRowSchema,
  sessionTagsRemoteMarkers,
} from '../src/index.ts'
import type { SessionTagsTablePort } from '../src/service.ts'
import type { SessionTagRowV1 } from '../src/wire.ts'

class MemoryTable implements SessionTagsTablePort {
  readonly rows = new Map<string, SessionTagRowV1>()
  get(key: string) { return this.rows.get(key) }
  entries() { return this.rows.entries() }
  async put(key: string, row: SessionTagRowV1) { this.rows.set(key, row) }
  async delete(key: string) { return this.rows.delete(key) }
}

function fakeSidecar(table: MemoryTable, sessions: Map<string, number>) {
  return createSessionTagsSidecar({
    table,
    identity: {
      async inspectIdentity(sessionId) {
        const createdAt = sessions.get(sessionId)
        return createdAt === undefined ? undefined : { createdAt: new Date(createdAt).toISOString() }
      },
    },
    newVersion: () => 'rv1',
  })
}

describe('sessionTags remote service', () => {
  it('binds the sessionTags namespace and marks list/set remotes', async () => {
    const ctx = new Context()
    const table = new MemoryTable()
    const remote = new SessionTagsRemoteService(ctx, fakeSidecar(table, new Map()))
    expect((remote as unknown as { name: string }).name).toBe(SESSION_TAGS_REMOTE_SERVICE_KEY)
    expect(SESSION_TAGS_REMOTE_SERVICE_KEY).toBe('sessionTags')
    expect(sessionTagsRemoteMarkers(remote)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'set', invocation: { kind: 'direct' } },
    ])
    await ctx.fiber.dispose()
  })

  it('list returns specVersion 1.0 and only live rows', async () => {
    const ctx = new Context()
    const table = new MemoryTable()
    const sessions = new Map([['s1', 10], ['s2', 20], ['dead', 30]])
    const remote = new SessionTagsRemoteService(ctx, fakeSidecar(table, sessions))
    const core = fakeSidecar(table, sessions)
    await core.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    await core.set({ sessionId: 'dead', tags: ['gone'], ifVersion: null })
    sessions.delete('dead')
    const result = await remote.list()
    expect(result).toMatchObject({ ok: true, specVersion: SESSION_TAGS_SPEC_VERSION })
    if (!result.ok) return
    expect(result.entries.map(e => e.row.tags)).toEqual([['a']])
    expect(SESSION_TAGS_SPEC_VERSION).toBe('1.0')
    await ctx.fiber.dispose()
  })

  it('set returns typed failures without retry', async () => {
    const ctx = new Context()
    const table = new MemoryTable()
    const sessions = new Map([['s1', 10]])
    const remote = new SessionTagsRemoteService(ctx, fakeSidecar(table, sessions))
    const core = fakeSidecar(table, sessions)
    const first = await remote.set({ sessionId: 's1', tags: ['a'], ifVersion: null })
    expect(first.ok).toBe(true)
    const conflict = await remote.set({ sessionId: 's1', tags: ['b'], ifVersion: null })
    expect(conflict).toMatchObject({ ok: false, code: 'version-conflict' })
    const invalid = await remote.set({ sessionId: 's1', tags: [''], ifVersion: 'rv1' })
    expect(invalid).toMatchObject({ ok: false, code: 'tags-invalid' })
    const missing = await remote.set({ sessionId: 'nope', tags: ['a'], ifVersion: null })
    expect(missing).toMatchObject({ ok: false, code: 'session-not-found' })
    await ctx.fiber.dispose()
  })
})

describe('domain spec and plugin face', () => {
  it('declares the additive domain shape', () => {
    expect(SESSION_TAGS_DOMAIN).toBe('yeisme.session-tags.v1')
    expect(sessionTagsDomainSpec).toMatchObject({ name: SESSION_TAGS_DOMAIN, version: 1 })
    expect(Object.keys(sessionTagsDomainSpec.tables)).toEqual(['sessions'])
  })

  it('row schema round-trips a valid row and rejects a malformed one', () => {
    const row: SessionTagRowV1 = {
      session: { createdAt: '1970-01-01T00:00:00.001Z', cwd: '/w' },
      tags: ['工作', 'research'],
      version: 'v1',
      updatedAt: 123,
    }
    expect(sessionTagRowSchema.safeParse(row).success).toBe(true)
    expect(sessionTagRowSchema.safeParse({ ...row, unknown: 1 }).success).toBe(false)
    expect(sessionTagRowSchema.safeParse({ ...row, version: 5 }).success).toBe(false)
  })

  it('declares the host plugin surface', () => {
    expect(name).toBe('dsh-session-tags-host')
    expect(inject).toEqual(['storageDomain', 'sessionPersistence'])
    expect(typeof apply).toBe('function')
  })

  it('mounts through a real cordis context over fake services', async () => {
    const ctx = new Context()
    const table = new MemoryTable()
    const sessions = new Map([['s1', 10]])
    ctx.provide('storageDomain', {
      async open() {
        return {
          name: SESSION_TAGS_DOMAIN,
          table: () => table,
          async close() {},
        }
      },
    })
    ctx.provide('sessionPersistence', {
      async list() {
        return [...sessions.entries()].map(([id, createdAt]) => ({ id, createdAt }))
      },
    })
    const fiber = await ctx.plugin({ name, inject, apply })
    const remote = ctx.get('sessionTags') as SessionTagsRemoteService
    expect(remote).toBeInstanceOf(SessionTagsRemoteService)
    const set = await remote.set({ sessionId: 's1', tags: ['wire'], ifVersion: null })
    expect(set.ok).toBe(true)
    const list = await remote.list()
    expect(list.ok && list.entries.map(e => e.row.tags)).toEqual([["wire"]])
    expect(table.rows.get('s1')?.tags).toEqual(['wire'])
    await fiber.dispose()
    await ctx.fiber.dispose()
  })
})
