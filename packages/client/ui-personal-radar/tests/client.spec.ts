import { describe, expect, it } from 'vitest'
import {
  RADAR_COMMAND_SPECS,
  RADAR_VIEW_KINDS,
  apply,
  type RadarClientFaceV1,
} from '../src/client/index.js'
import { FAKE_RADAR_DEMO_PROJECTION, type RadarCapabilityProbeResultV1 } from '@yeisme/dsh-personal-radar'
import type { RadarClientProbeResultV1 } from '../src/client/probe.js'

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

function fakeHost(probeReady = true) {
  return {
    probe: async (): Promise<RadarCapabilityProbeResultV1> => ({
      ready: probeReady,
      ...(probeReady ? {} : { reason: 'needs_radar' as const }),
      detail: probeReady ? 'ready' : 'radar binary unreachable',
      binary: { ok: true, detail: 'ok' },
      contract: { ok: true, detail: 'ok' },
      capabilities: { ok: probeReady, detail: 'ok' },
      paneSlot: { ok: true, detail: 'ok' },
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

describe('personal radar client apply', () => {
  it('registers badge + pane views and the /drama radar command entries when seams probe', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, radarHost: fakeHost() })
    const dispose = await apply(ctx as never)

    expect(pane.views.has(RADAR_VIEW_KINDS.badge)).toBe(true)
    expect(pane.views.has(RADAR_VIEW_KINDS.pane)).toBe(true)
    expect(pane.commands.size).toBe(RADAR_COMMAND_SPECS.length)

    dispose()
    expect(pane.views.size).toBe(0)
    expect(pane.commands.size).toBe(0)
  })

  it('second apply is a no-op on an already-mounted context', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, radarHost: fakeHost() })
    const first = await apply(ctx as never)
    const second = await apply(ctx as never)
    expect(pane.views.size).toBe(2)
    second()
    expect(pane.views.size).toBe(2)
    first()
    expect(pane.views.size).toBe(0)
  })

  it('fails closed with a probe-only face when the pane slot is missing', async () => {
    const ctx = fakeCtx({ radarHost: fakeHost() })
    const dispose = await apply(ctx as never)
    const face = ctx.get('personalRadar') as { probe: RadarClientProbeResultV1 }
    expect(face).toBeDefined()
    expect(face.probe.available).toBe(false)
    expect(face.probe.paneWorkbench.reason).toContain('seam_unavailable')
    dispose()
  })

  it('fails closed when the radar host transport is missing', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face })
    await apply(ctx as never)
    const face = ctx.get('personalRadar') as { probe: RadarClientProbeResultV1 }
    expect(face.probe.available).toBe(false)
    expect(face.probe.radarHost.reason).toContain('needs_radar')
    expect(pane.views.size).toBe(0)
  })

  it('disables the entry when the owner probe reports not ready', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, radarHost: fakeHost(false) })
    await apply(ctx as never)
    const face = ctx.get('personalRadar') as { probe: RadarClientProbeResultV1 }
    expect(face.probe.available).toBe(false)
    expect(face.probe.radarHost.reason).toContain('needs_radar')
  })

  it('badge model and pane frame expose text + icon double expression', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, radarHost: fakeHost() })
    const dispose = await apply(ctx as never)
    const face = ctx.get('personalRadar') as RadarClientFaceV1
    await face.refreshProjection()

    const badge = face.badgeModel()
    expect(badge?.text).toContain('Radar · 3 fits · 2 new')
    expect(badge?.icon).toBeTruthy()
    expect(badge?.ariaLabel).toContain('Drama Radar')

    const frame = face.paneFrame(80, 24)
    expect(frame.split('\n')).toHaveLength(24)
    dispose()
  })

  it('runs /drama radar commands through the host transport with receipts', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, radarHost: fakeHost() })
    const dispose = await apply(ctx as never)
    const face = ctx.get('personalRadar') as RadarClientFaceV1

    const result = await face.runRadarCommand('/drama radar save opp:demo-1')
    expect(result.ok).toBe(true)
    expect(face.paneState().status).toBe('ready')

    const usage = await face.runRadarCommand('/drama radar frobnicate')
    expect(usage.ok).toBe(false)
    expect(usage.reason).toContain('unknown radar subcommand')
    dispose()
  })
})
