import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  SESSION_STATUS_REMOTE_SERVICE_KEY,
  SESSION_STATUS_SPEC_VERSION,
  SessionStatusRemoteService,
  SessionStatusService,
  apply,
  inject,
  name,
  sessionStatusRemoteMarkers,
} from '../src/index.ts'

describe('sessionStatus remote service', () => {
  it('binds the sessionStatus namespace and marks probe/snapshot remotes', async () => {
    const ctx = new Context()
    const service = new SessionStatusService({ now: () => new Date('2026-09-01T00:00:00.000Z') })
    const remote = new SessionStatusRemoteService(ctx, service)
    expect((remote as unknown as { name: string }).name).toBe(SESSION_STATUS_REMOTE_SERVICE_KEY)
    expect(SESSION_STATUS_REMOTE_SERVICE_KEY).toBe('sessionStatus')
    expect(sessionStatusRemoteMarkers(remote)).toEqual([
      { method: 'probe', invocation: { kind: 'direct' } },
      { method: 'snapshot', invocation: { kind: 'direct' } },
    ])
    await ctx.fiber.dispose()
  })

  it('probe declares the session-status capability without claiming streaming', async () => {
    const ctx = new Context()
    const remote = new SessionStatusRemoteService(ctx, new SessionStatusService())
    const probe = await remote.probe()
    expect(probe).toEqual({
      ok: true,
      specVersion: SESSION_STATUS_SPEC_VERSION,
      capabilities: ['session-status'],
      subscription: false,
    })
    await ctx.fiber.dispose()
  })

  it('snapshot returns the parsed projection for a valid sessionRef', async () => {
    const ctx = new Context()
    const service = new SessionStatusService({
      lookup: {
        identity: sessionRef => ({ sessionRef, label: 'Main', lifecycle: 'running' }),
        runtime: () => ({ providerId: 'deepseek', modelLabel: 'deepseek-chat' }),
        tokenMeter: () => ({ usedTokens: 1200, limitTokens: 10000 }),
      },
      now: () => new Date('2026-09-01T00:00:00.000Z'),
    })
    const remote = new SessionStatusRemoteService(ctx, service)
    const answer = await remote.snapshot({ sessionRef: 'sess_1' })
    expect(answer).toMatchObject({ ok: true, specVersion: SESSION_STATUS_SPEC_VERSION })
    if (!answer.ok) throw new Error('unreachable')
    expect(answer.snapshot.schemaVersion).toBe('session.status.snapshot.v1alpha1')
    expect(answer.snapshot.status).toBe('ready')
    expect(answer.snapshot.session.lifecycle).toBe('running')
    expect(answer.snapshot.runtime).toEqual({ providerId: 'deepseek', modelLabel: 'deepseek-chat' })
    expect(answer.snapshot.context.remainingRatio).toBe(0.88)
    await ctx.fiber.dispose()
  })

  it('rejects invalid and credential-shaped session refs safely', async () => {
    const ctx = new Context()
    const remote = new SessionStatusRemoteService(ctx, new SessionStatusService())
    for (const input of [
      { sessionRef: '/abs/path' },
      { sessionRef: 'sess?apikey=sk-x' },
      { sessionRef: 'sk-abc123' },
      { sessionRef: 'a'.repeat(200) },
    ]) {
      const answer = await remote.snapshot(input)
      expect(answer).toMatchObject({ ok: false, code: 'invalid_session_ref' })
    }
    for (const input of [undefined, null, 'sess_1', 42, {}, { sessionRef: 7 }]) {
      const answer = await remote.snapshot(input)
      expect(answer).toMatchObject({ ok: false, code: 'invalid_session_ref' })
    }
    await ctx.fiber.dispose()
  })

  it('degrades per source when no lookup is wired', async () => {
    const ctx = new Context()
    const remote = new SessionStatusRemoteService(
      ctx,
      new SessionStatusService({ now: () => new Date('2026-09-01T00:00:00.000Z') }),
    )
    const answer = await remote.snapshot({ sessionRef: 'sess_1' })
    if (!answer.ok) throw new Error('unreachable')
    expect(answer.snapshot.status).toBe('unavailable')
    expect(answer.snapshot.session.lifecycle).toBe('unknown')
    expect(answer.snapshot.context).toMatchObject({ status: 'unavailable', source: 'none' })
    expect(answer.snapshot.limits).toEqual([])
    await ctx.fiber.dispose()
  })
})

describe('sessionStatus host apply', () => {
  function fakeRegistry(options: {
    readonly pressure?: unknown
    readonly onChanged?: (listener: (session: { id: string }, key: string) => void) => () => void
  }) {
    return {
      snapshot: () => ({ asOfSeq: 3, values: { contextPressure: options.pressure } }),
      ...(options.onChanged === undefined ? {} : { onChanged: options.onChanged }),
    }
  }

  it('declares the probe-first plugin surface', () => {
    expect(name).toBe('dsh-session-status-host')
    expect(inject).toEqual([])
    expect(typeof apply).toBe('function')
  })

  it('mounts over probed seams and serves owner facts', async () => {
    const ctx = new Context()
    ctx.provide('sessions', {
      get: (id: string) => (id === 'sess_1' ? { id } : undefined),
    })
    ctx.provide('agents', {
      get: (id: string) => id === 'sess_1'
        ? { status: 'running', options: { provider: 'deepseek', model: 'deepseek-chat' } }
        : undefined,
    })
    ctx.provide('sessionProjections', fakeRegistry({
      pressure: { pressureTokens: 2000, projectedTokens: 2400, contextWindow: 64000 },
    }))
    const fiber = await ctx.plugin({ name, inject, apply })
    const remote = ctx.get('sessionStatus') as SessionStatusRemoteService
    expect(remote).toBeInstanceOf(SessionStatusRemoteService)
    const answer = await remote.snapshot({ sessionRef: 'sess_1' })
    if (!answer.ok) throw new Error('unreachable')
    expect(answer.snapshot.status).toBe('ready')
    expect(answer.snapshot.session.lifecycle).toBe('running')
    expect(answer.snapshot.runtime).toEqual({ providerId: 'deepseek', modelLabel: 'deepseek-chat' })
    expect(answer.snapshot.context).toMatchObject({
      status: 'ready',
      source: 'token-meter',
      usedTokens: 2400,
      limitTokens: 64000,
    })
    const missing = await remote.snapshot({ sessionRef: 'sess_gone' })
    if (!missing.ok) throw new Error('unreachable')
    expect(missing.snapshot.session.lifecycle).toBe('unknown')
    expect(missing.snapshot.context.status).toBe('unavailable')
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('fails closed per source when sessionProjections is absent', async () => {
    const ctx = new Context()
    ctx.provide('sessions', { get: (id: string) => ({ id }) })
    ctx.provide('agents', { get: () => ({ status: 'idle' }) })
    const fiber = await ctx.plugin({ name, inject, apply })
    const remote = ctx.get('sessionStatus') as SessionStatusRemoteService
    const answer = await remote.snapshot({ sessionRef: 'sess_1' })
    if (!answer.ok) throw new Error('unreachable')
    expect(answer.snapshot.status).toBe('partial')
    expect(answer.snapshot.session.lifecycle).toBe('idle')
    expect(answer.snapshot.context).toMatchObject({ status: 'unavailable', source: 'none' })
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('never throws and reports unavailable when every seam is missing', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin({ name, inject, apply })
    const remote = ctx.get('sessionStatus') as SessionStatusRemoteService
    const answer = await remote.snapshot({ sessionRef: 'sess_1' })
    if (!answer.ok) throw new Error('unreachable')
    expect(answer.snapshot.status).toBe('unavailable')
    expect(answer.snapshot.freshness).toBe('unknown')
    await fiber.dispose()
    await ctx.fiber.dispose()
  })

  it('bumps revisions on projection changes and releases the feed on dispose', async () => {
    const ctx = new Context()
    let listener: ((session: { id: string }, key: string) => void) | undefined
    let disposed = 0
    ctx.provide('sessions', { get: (id: string) => ({ id }) })
    ctx.provide('sessionProjections', fakeRegistry({
      pressure: { projectedTokens: 100, contextWindow: 1000 },
      onChanged: (candidate) => {
        listener = candidate
        return () => { disposed += 1 }
      },
    }))
    const fiber = await ctx.plugin({ name, inject, apply })
    const remote = ctx.get('sessionStatus') as SessionStatusRemoteService
    const first = await remote.snapshot({ sessionRef: 'sess_1' })
    if (!first.ok) throw new Error('unreachable')
    expect(listener).toBeDefined()
    listener?.({ id: 'sess_1' }, 'contextPressure')
    listener?.({ id: 'sess_1' }, 'unrelatedKey')
    const second = await remote.snapshot({ sessionRef: 'sess_1' })
    if (!second.ok) throw new Error('unreachable')
    expect(second.snapshot.revision).toBe(first.snapshot.revision + 2)
    await fiber.dispose()
    expect(disposed).toBe(1)
    await ctx.fiber.dispose()
  })
})
