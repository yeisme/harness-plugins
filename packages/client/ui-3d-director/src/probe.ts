import { probeCapability, type ProbeResult } from '@yeisme/dsh-plugin-contracts'
import { isScene3DDirectorRemote, SCENE_3D_DIRECTOR_REMOTE_KEY, type Scene3DDirectorRemote } from './remote.js'

/** Minimal context reader face (ClientContext-compatible). */
export interface Scene3DContextReader {
  get(name: never): unknown
}

export const SCENE_3D_PROBE_REASONS = {
  needsContract: 'scene3dDirector remote seam is not mounted; the 3D Director stays disabled',
  ready: 'scene3dDirector remote is available',
} as const

function readContextService(ctx: Scene3DContextReader, name: string): unknown {
  // Deliberately uncaught: probeCapability maps a throwing context to
  // `unavailable`, while a missing service is `needs_contract`.
  return ctx.get(name as never)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function resolveScene3DRemote(ctx: Scene3DContextReader): Scene3DDirectorRemote | undefined {
  const direct = readContextService(ctx, `remote.${SCENE_3D_DIRECTOR_REMOTE_KEY}`)
  if (direct !== undefined) return isScene3DDirectorRemote(direct) ? direct : undefined
  const remote = readContextService(ctx, 'remote')
  if (!isRecord(remote)) return undefined
  const member = remote[SCENE_3D_DIRECTOR_REMOTE_KEY]
  return isScene3DDirectorRemote(member) ? member : undefined
}

/**
 * Probe the host `scene3dDirector` remote. A missing or shape-mismatched seam
 * yields needs_contract/unavailable — the panel renders a disabled Surface
 * with the reason instead of a dead button.
 */
export function probeScene3DDirector(ctx: Scene3DContextReader): ProbeResult<Scene3DDirectorRemote> {
  return probeCapability(() => resolveScene3DRemote(ctx))
}
