/**
 * Client-side capability probes for the Drama Radar entry points.
 *
 * Probes the Pane Workbench face (the official pane slot seam) and the
 * `radarHost` transport the host adapter provides. Missing seams map to
 * stable disabled reasons; nothing fakes a host or touches the private DOM.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  RadarCapabilityProbeResultV1,
  RadarIntentV1,
  RadarProjectionV1,
  RadarActionReceiptV1,
} from '@yeisme/dsh-personal-radar'

/** Minimal Pane Workbench client face consumed by this plugin. */
export interface RadarPaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
  registerCommand?(input: unknown): () => void
}

/** Radar host transport: the only channel that returns RadarProjectionV1. */
export interface RadarHostTransport {
  probe(): Promise<RadarCapabilityProbeResultV1>
  snapshot(): Promise<RadarProjectionV1>
  dispatch?(intent: RadarIntentV1): Promise<RadarActionReceiptV1>
}

export type RadarClientDependency = 'paneWorkbench' | 'radarHost'

export interface RadarClientProbeEntryV1 {
  readonly available: boolean
  readonly reason: string
}

export interface RadarClientProbeResultV1 {
  /** True only when paneWorkbench + radarHost both probe. */
  readonly available: boolean
  readonly paneWorkbench: RadarClientProbeEntryV1
  readonly radarHost: RadarClientProbeEntryV1
}

export interface RadarClientProbeResolution {
  readonly probe: RadarClientProbeResultV1
  readonly pane?: RadarPaneWorkbenchFace
  readonly radarHost?: RadarHostTransport
}

export const RADAR_CLIENT_PROBE_REASONS = {
  paneWorkbench: 'seam_unavailable: the official Pane slot is unavailable; badge, commands, and the radar pane stay disabled',
  radarHost: 'needs_radar: the radar host transport is unavailable; install short-drama-radar and retry',
  ready: 'drama radar client capability is ready',
} as const

type ContextReader = Pick<ClientContext, 'get'>

function readContextService<T>(ctx: ContextReader, name: string): T | undefined {
  try {
    return ctx.get(name as never) as T | undefined
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isPaneWorkbenchFace(value: unknown): value is RadarPaneWorkbenchFace {
  return isRecord(value)
    && typeof value.registerView === 'function'
    && typeof value.openView === 'function'
}

function isRadarHostTransport(value: unknown): value is RadarHostTransport {
  return isRecord(value)
    && typeof value.probe === 'function'
    && typeof value.snapshot === 'function'
}

export async function probeRadarClientCapability(ctx: ContextReader): Promise<RadarClientProbeResolution> {
  const pane = readContextService<RadarPaneWorkbenchFace>(ctx, 'paneWorkbench')
  const radarHost = readContextService<RadarHostTransport>(ctx, 'radarHost')
  const paneOk = pane !== undefined && isPaneWorkbenchFace(pane)

  let hostOk = radarHost !== undefined && isRadarHostTransport(radarHost)
  let hostReason: string = RADAR_CLIENT_PROBE_REASONS.radarHost
  if (hostOk && radarHost !== undefined) {
    try {
      const ownerProbe = await radarHost.probe()
      hostOk = ownerProbe.ready
      if (!ownerProbe.ready) hostReason = `${ownerProbe.reason ?? 'needs_radar'}: ${ownerProbe.detail}`
    } catch {
      hostOk = false
    }
  }

  const probe: RadarClientProbeResultV1 = {
    available: paneOk && hostOk,
    paneWorkbench: {
      available: paneOk,
      reason: paneOk ? RADAR_CLIENT_PROBE_REASONS.ready : RADAR_CLIENT_PROBE_REASONS.paneWorkbench,
    },
    radarHost: {
      available: hostOk,
      reason: hostOk ? RADAR_CLIENT_PROBE_REASONS.ready : hostReason,
    },
  }
  return {
    probe,
    ...(paneOk && pane !== undefined ? { pane } : {}),
    ...(hostOk && radarHost !== undefined ? { radarHost } : {}),
  }
}
