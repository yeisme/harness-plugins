/**
 * DSH Web Personal Drama Radar client entry.
 *
 * Real wiring: the badge view and the on-demand Radar pane register into
 * the Pane Workbench runtime via `registerView`, and the /drama radar
 * command entries register via `registerCommand`. Every dependency is
 * probed first; when the official pane slot or the radar host transport is
 * missing, the plugin registers nothing beyond a probe-only face with the
 * disabled reason — no private DOM, no iframe, no fork fallback. No
 * window/document-level listeners, no polling.
 *
 * @module @yeisme/dsh-client-ui-personal-radar/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import {
  RADAR_COMMAND_USAGE,
  createRadarPaneState,
  isRadarBadgeVisible,
  parseRadarCommand,
  renderRadarPane,
  summarizeRadarBadge,
  updateRadarPane,
  validateRadarIntent,
  type RadarBadgeModelV1,
  type RadarPaneStateV1,
  type RadarProjectionV1,
} from '@yeisme/dsh-personal-radar'
import {
  probeRadarClientCapability,
  type RadarClientProbeResultV1,
  type RadarHostTransport,
  type RadarPaneWorkbenchFace,
} from './probe.js'

export const RADAR_VIEW_KINDS = {
  badge: 'drama-radar.badge',
  pane: 'drama-radar.pane',
} as const

export interface RadarCommandSpecV1 {
  readonly id: string
  readonly label: string
  readonly hint: string
}

export const RADAR_COMMAND_SPECS: readonly RadarCommandSpecV1[] = [
  { id: 'drama.radar.open', label: 'Radar · Open', hint: '/drama radar [open <ref>]' },
  { id: 'drama.radar.save', label: 'Radar · Save', hint: '/drama radar save <opportunity-ref>' },
  { id: 'drama.radar.dismiss', label: 'Radar · Dismiss', hint: '/drama radar dismiss <opportunity-ref>' },
  { id: 'drama.radar.compare', label: 'Radar · Compare', hint: '/drama radar compare <ref-a> <ref-b>' },
  { id: 'drama.radar.proposal', label: 'Radar · Proposal', hint: '/drama radar proposal <opportunity-ref>' },
  { id: 'drama.radar.workbench', label: 'Radar · Workbench', hint: '/drama radar workbench <ref>' },
  { id: 'drama.radar.refresh', label: 'Radar · Refresh', hint: '/drama radar refresh' },
] as const

export interface RadarClientFaceV1 {
  readonly probe: RadarClientProbeResultV1
  badgeModel(): RadarBadgeModelV1 | undefined
  paneFrame(width: number, height: number): string
  paneState(): RadarPaneStateV1
  openRadarPane(): void
  runRadarCommand(line: string): Promise<{ readonly ok: boolean; readonly reason: string }>
  refreshProjection(): Promise<void>
}

type ContextReader = Pick<ClientContext, 'get'>

function readContextService<T>(ctx: ContextReader, name: string): T | undefined {
  try {
    return ctx.get(name as never) as T | undefined
  } catch {
    return undefined
  }
}

function provide<T>(ctx: ClientContext, name: string, value: T): () => void {
  try {
    return (ctx as unknown as { provide(name: string, value: T): () => void }).provide(name as never, value) as () => void
  } catch {
    return () => {}
  }
}

interface RadarRuntimeV1 {
  readonly face: RadarClientFaceV1
  readonly dispose: () => void
}

function createRuntime(input: {
  readonly ctx: ClientContext
  readonly pane: RadarPaneWorkbenchFace
  readonly radarHost: RadarHostTransport
  readonly probe: RadarClientProbeResultV1
}): RadarRuntimeV1 {
  const { pane, radarHost } = input
  const disposers: (() => void)[] = []
  let projection: RadarProjectionV1 | undefined
  let paneState: RadarPaneStateV1 = createRadarPaneState()
  let disposed = false

  const badgeModel = (): RadarBadgeModelV1 | undefined => {
    if (projection === undefined) return undefined
    if (!isRadarBadgeVisible(projection.status)) return undefined
    return summarizeRadarBadge(projection)
  }

  const openRadarPane = (): void => {
    pane.openView({ kind: RADAR_VIEW_KINDS.pane })
  }

  const refreshProjection = async (): Promise<void> => {
    try {
      projection = await radarHost.snapshot()
      paneState = updateRadarPane(paneState, { type: 'projection_loaded', projection })
    } catch (error) {
      paneState = updateRadarPane(paneState, {
        type: 'projection_failed',
        status: 'offline',
        message: error instanceof Error ? error.message : 'radar owner unreachable',
      })
    }
  }

  const runRadarCommand = async (line: string): Promise<{ ok: boolean; reason: string }> => {
    const parsed = parseRadarCommand(line)
    if (!parsed.ok) return { ok: false, reason: `${parsed.reason}. Usage: ${RADAR_COMMAND_USAGE.join(' · ')}` }
    if (!validateRadarIntent(parsed.intent)) return { ok: false, reason: 'intent failed contract validation' }
    if (parsed.intent.kind === 'open') {
      openRadarPane()
      return { ok: true, reason: 'radar pane opened' }
    }
    if (radarHost.dispatch === undefined) {
      return { ok: false, reason: 'needs_radar: the radar host cannot dispatch mutations' }
    }
    const [ref] = parsed.intent.opportunityRefs
    if (ref !== undefined) {
      paneState = updateRadarPane(paneState, { type: 'action_submitted', ref })
    }
    const receipt = await radarHost.dispatch(parsed.intent)
    paneState = updateRadarPane(paneState, {
      type: 'action_receipt',
      ref: ref ?? parsed.intent.idempotencyKey,
      outcome: receipt.outcome === 'reconciled' ? 'reconciled' : receipt.outcome,
      message: receipt.reason,
    })
    if (receipt.outcome === 'submitted' || receipt.outcome === 'reconciled') {
      await refreshProjection()
    }
    return { ok: receipt.outcome === 'submitted' || receipt.outcome === 'reconciled', reason: receipt.reason }
  }

  disposers.push(pane.registerView({
    descriptor: {
      kind: RADAR_VIEW_KINDS.badge,
      label: 'Drama Radar',
      componentKey: 'radarBadge',
      role: 'utility',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: true,
    },
    component: () => badgeModel(),
  }))
  disposers.push(pane.registerView({
    descriptor: {
      kind: RADAR_VIEW_KINDS.pane,
      label: 'Drama Radar Pane',
      componentKey: 'radarPane',
      role: 'content',
      preferredRegion: 'either',
      retention: 'recreate',
      singleton: true,
    },
    component: () => renderRadarPane(paneState, paneState.width, paneState.height),
  }))
  if (typeof pane.registerCommand === 'function') {
    for (const spec of RADAR_COMMAND_SPECS) {
      disposers.push(pane.registerCommand({
        descriptor: {
          id: spec.id,
          label: spec.label,
          slash: { name: 'drama', hint: spec.hint, category: 'work' },
        },
        execute: () => openRadarPane(),
      }))
    }
  }

  const face: RadarClientFaceV1 = {
    probe: input.probe,
    badgeModel,
    paneFrame: (width: number, height: number) => {
      paneState = updateRadarPane(paneState, { type: 'resize', width, height })
      return renderRadarPane(paneState, width, height)
    },
    paneState: () => paneState,
    openRadarPane,
    runRadarCommand,
    refreshProjection,
  }

  return {
    face,
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const dispose of disposers.reverse()) dispose()
    },
  }
}

/**
 * Mounts the Personal Radar client face and returns an exact, idempotent
 * disposer. A second apply on an already-mounted context is a no-op; after
 * dispose, apply rebuilds cleanly (HMR-safe). Missing seams fail closed with
 * a probe-only face that carries the disabled reason.
 */
export async function apply(ctx: ClientContext): Promise<() => void> {
  const existing = readContextService<RadarClientFaceV1>(ctx, 'personalRadar')
  if (existing !== undefined) return () => {}

  const { probe, pane, radarHost } = await probeRadarClientCapability(ctx)

  if (pane === undefined || radarHost === undefined) {
    // Fail closed: no badge/command/pane registration without the official
    // pane slot and the radar host transport. The probe projection stays
    // visible so the capability matrix explains why the entry is disabled.
    const probeOnlyFace: Pick<RadarClientFaceV1, 'probe'> = { probe }
    const unprovide = provide(ctx, 'personalRadar', probeOnlyFace)
    return unprovide
  }

  const runtime = createRuntime({ ctx, pane, radarHost, probe })
  const unprovide = provide(ctx, 'personalRadar', runtime.face)

  // Initial projection resolution is best-effort; failures degrade to an
  // offline, read-only state instead of throwing out of apply().
  void runtime.face.refreshProjection()

  return () => {
    unprovide()
    runtime.dispose()
  }
}

export {
  probeRadarClientCapability,
  RADAR_CLIENT_PROBE_REASONS,
} from './probe.js'
export type {
  RadarClientDependency,
  RadarClientProbeEntryV1,
  RadarClientProbeResultV1,
  RadarClientProbeResolution,
  RadarHostTransport,
  RadarPaneWorkbenchFace,
} from './probe.js'
