import './primitives.js'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.js'
import { RADAR_VIEW_KINDS } from '../src/client/index.js'
import { FAKE_RADAR_DEMO_PROJECTION, type RadarCapabilityProbeResultV1 } from '@yeisme/dsh-personal-radar'

function fakePane() {
  const views = new Map<string, unknown>()
  const commands = new Map<string, unknown>()
  return {
    views,
    commands,
    face: {
      registerView(input: { descriptor: { kind: string } }) {
        views.set(input.descriptor.kind, input)
        return () => views.delete(input.descriptor.kind)
      },
      registerCommand(input: { descriptor: { id: string } }) {
        commands.set(input.descriptor.id, input)
        return () => commands.delete(input.descriptor.id)
      },
      openView() {},
    },
  }
}

function fakeHost() {
  return {
    probe: async (): Promise<RadarCapabilityProbeResultV1> => ({
      ready: true, detail: 'ready', binary: { ok: true, detail: 'ok' }, contract: { ok: true, detail: 'ok' },
      capabilities: { ok: true, detail: 'ok' }, paneSlot: { ok: true, detail: 'ok' },
    }),
    snapshot: async () => FAKE_RADAR_DEMO_PROJECTION,
    dispatch: async () => ({
      schema: 'dsh.radar.receipt.v1' as const,
      idempotencyKey: 'radar-save-opp:demo-1',
      outcome: 'submitted' as const,
      reason: 'saved',
    }),
  }
}

function fakeMarketHost(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'dsh.radar.market-host.v1',
    contextRef: () => 'session-a',
    load: async () => ({ ok: false, reason: 'brief_absent', recovery: 'No brief' }),
    subscribeContext: () => () => {},
    subscribePolicy: () => () => {},
    ...overrides,
  }
}

function fakeCtx(services: Record<string, unknown>) {
  const provided = new Map<string, unknown>(Object.entries(services))
  return {
    get(name: string) {
      return provided.get(name)
    },
    provide(name: string, value: unknown) {
      provided.set(name, value)
      return () => {
        provided.delete(name)
      }
    },
  }
}

describe('market Web face mount contract (dsh-radar-market-intelligence-v1 §2.1)', () => {
  it('a typed radarMarketHost seam registers the market view and command exactly once', async () => {
    const pane = fakePane()
    let subscriptions = 0
    const market = fakeMarketHost({
      subscribeContext: () => { subscriptions++; return () => { subscriptions-- } },
      subscribePolicy: () => { subscriptions++; return () => { subscriptions-- } },
    })
    const ctx = fakeCtx({ paneWorkbench: pane.face, radarMarketHost: market })
    const dispose = await apply(ctx as never)
    expect(pane.views.has('drama-radar.market')).toBe(true)
    expect(pane.commands.has('drama.radar.market')).toBe(true)
    expect(pane.views.has(RADAR_VIEW_KINDS.pane)).toBe(false)
    expect(subscriptions).toBe(2)
    dispose()
    // Symmetric teardown: view, command and both host subscriptions.
    expect(pane.views.has('drama-radar.market')).toBe(false)
    expect(pane.commands.has('drama.radar.market')).toBe(false)
    expect(subscriptions).toBe(0)
  })

  it('a second apply (HMR remount) is a no-op while the first mount stays authoritative', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, radarMarketHost: fakeMarketHost() })
    const first = await apply(ctx as never)
    const second = await apply(ctx as never)
    expect(pane.views.size).toBe(1)
    expect(pane.commands.size).toBe(1)
    second()
    expect(pane.views.size).toBe(1)
    first()
    expect(pane.views.size).toBe(0)
    expect(pane.commands.size).toBe(0)
  })

  it('a missing radarMarketHost seam leaves no market face while the legacy personal face stays intact', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, radarHost: fakeHost() })
    const dispose = await apply(ctx as never)
    expect(pane.views.has('drama-radar.market')).toBe(false)
    expect(pane.commands.has('drama.radar.market')).toBe(false)
    expect(pane.views.has(RADAR_VIEW_KINDS.badge)).toBe(true)
    expect(pane.views.has(RADAR_VIEW_KINDS.pane)).toBe(true)
    dispose()
    expect(pane.views.size).toBe(0)
  })

  it('a foreign radarMarketHost (wrong schema) never mounts the market face', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, radarMarketHost: { schema: 'dsh.radar.projection.v1' } })
    const dispose = await apply(ctx as never)
    expect(pane.views.has('drama-radar.market')).toBe(false)
    dispose()
  })
})
