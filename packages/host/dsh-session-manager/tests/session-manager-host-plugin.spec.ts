import { describe, expect, it } from 'vitest'
import {
  apply,
  bindSessionManagerHost,
  isSessionManagerHostV1,
  resolveSessionManagerHost,
  SESSION_MANAGER_HOST_CONTEXT_KEY,
  type SessionManagerHostPluginContext,
  type SessionManagerHostV1,
} from '../src/index.ts'

type Activation = (child: SessionManagerHostPluginContext) => void | (() => void)

interface Harness {
  readonly ctx: SessionManagerHostPluginContext
  readonly provided: Map<string, unknown>
  readonly effectCalls: number
  /** Fire the recorded dynamic-inject activation with the given child scope. */
  fire(child?: SessionManagerHostPluginContext): (() => void) | undefined
}

function liveServices(): Record<string, unknown> {
  return {
    sessionPersistence: { async list() { return [{ id: 'session-1', createdAt: 1 }] } },
    workspaceRegistry: { list: () => [], archivedSessionIds: [], async archiveSession() {} },
    agents: { get: () => undefined },
  }
}

/** Minimal structural Cordis double: dynamic-inject activations fire manually. */
function harness(options: { readonly seams?: 'live' | 'absent' | 'drifted'; readonly withEffect?: boolean } = {}): Harness {
  const seams = options.seams ?? 'live'
  const provided = new Map<string, unknown>()
  let activation: Activation | undefined
  let activationTeardown: (() => void) | undefined
  let effectCalls = 0
  const base: Record<string, unknown> = {
    inject: (names: readonly string[], callback: Activation) => {
      expect(names).toEqual(['sessionPersistence', 'workspaceRegistry', 'agents'])
      activation = callback
      return () => {
        activationTeardown?.()
        activationTeardown = undefined
        activation = undefined
      }
    },
    provide: (key: string, service: unknown) => {
      provided.set(key, service)
      return () => {
        if (provided.get(key) === service) provided.delete(key)
      }
    },
    get: (name: string) => {
      if (name === 'sessionQuery') return undefined
      throw new Error('service not found')
    },
  }
  if (seams === 'live') Object.assign(base, liveServices())
  if (seams === 'drifted') {
    Object.assign(base, liveServices(), { workspaceRegistry: { list: () => [] } })
  }
  const ctx = {
    ...base,
    ...(options.withEffect === true ? {
      effect: (setup: () => () => void): (() => void) => {
        effectCalls += 1
        const teardown = setup()
        return () => { teardown() }
      },
    } : {}),
  } as SessionManagerHostPluginContext
  return {
    ctx,
    provided,
    get effectCalls() { return effectCalls },
    fire(child?: SessionManagerHostPluginContext): (() => void) | undefined {
      expect(activation).toBeTypeOf('function')
      const teardown = activation?.(child ?? ctx)
      if (typeof teardown === 'function') activationTeardown = teardown
      return activationTeardown
    },
  }
}

describe('dsh-session-manager-host plugin', () => {
  it('mounts the official-seam adapter when every required seam is live', async () => {
    const world = harness()
    const dispose = apply(world.ctx)
    try {
      const teardown = world.fire()
      const provided = world.provided.get(SESSION_MANAGER_HOST_CONTEXT_KEY)
      expect(isSessionManagerHostV1(provided)).toBe(true)
      expect(resolveSessionManagerHost()).toBe(provided)
      await expect(resolveSessionManagerHost().listSessions()).resolves.toEqual([
        { sessionId: 'session-1', archived: false, running: false, unread: false, labels: [] },
      ])
      teardown?.()
      expect(world.provided.has(SESSION_MANAGER_HOST_CONTEXT_KEY)).toBe(false)
      await expect(resolveSessionManagerHost().listSessions()).resolves.toEqual([])
    } finally {
      dispose()
    }
  })

  it('keeps the placeholder default when official seams never resolve', async () => {
    const world = harness({ seams: 'absent' })
    const dispose = apply(world.ctx)
    try {
      expect(world.provided.has(SESSION_MANAGER_HOST_CONTEXT_KEY)).toBe(false)
      const host = resolveSessionManagerHost()
      await expect(host.listSessions()).resolves.toEqual([])
      await expect(host.archiveSession('session-1')).resolves.toMatchObject({ status: 'not_implemented' })
      await expect(host.forkSession('session-1')).resolves.toMatchObject({ status: 'not_implemented' })
    } finally {
      dispose()
    }
  })

  it('stays on the placeholder default when a live seam shape drifts', async () => {
    const world = harness({ seams: 'live' })
    const drifted = harness({ seams: 'drifted' })
    const dispose = apply(world.ctx)
    try {
      world.fire(drifted.ctx)
      expect(world.provided.has(SESSION_MANAGER_HOST_CONTEXT_KEY)).toBe(false)
      expect(isSessionManagerHostV1(resolveSessionManagerHost())).toBe(true)
      await expect(resolveSessionManagerHost().listSessions()).resolves.toEqual([])
    } finally {
      dispose()
    }
  })

  it('rides the plugin fiber when ctx.effect is available and keeps teardown idempotent', () => {
    const world = harness({ withEffect: true })
    const dispose = apply(world.ctx)
    expect(world.effectCalls).toBe(1)
    dispose()
    dispose()
  })
})

describe('bindSessionManagerHost late binding', () => {
  it('restores the placeholder after unbind', async () => {
    const rows = [{ sessionId: 'live-1', archived: false, running: true, unread: false, labels: [] }]
    const bound: SessionManagerHostV1 = {
      version: '0.1.0-rc.1',
      capability: 'session-manager',
      async listSessions() {
        return rows
      },
      async archiveSession(sessionId) { return { status: 'ok', sessionId } },
      async restoreSession(sessionId) { return { status: 'ok', sessionId } },
      async trashSession(sessionId) { return { status: 'ok', sessionId } },
      async purgeSession(sessionId) { return { status: 'ok', sessionId } },
      async setLabels(sessionId) { return { status: 'ok', sessionId } },
      async pauseSession(sessionId) { return { status: 'ok', sessionId } },
      async resumeSession(sessionId) { return { status: 'ok', sessionId } },
      async forkSession(sessionId) { return { status: 'ok', sessionId, childSessionId: 'child' } },
    }
    const unbind = bindSessionManagerHost(bound)
    await expect(resolveSessionManagerHost().listSessions()).resolves.toEqual(rows)
    unbind()
    await expect(resolveSessionManagerHost().listSessions()).resolves.toEqual([])
  })
})
