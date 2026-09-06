/**
 * Probe-first session status client. Missing remotes stay unavailable.
 */

import {
  parseSessionStatusProbe,
  parseSessionStatusSnapshot,
  unavailableClientSnapshot,
  type SessionStatusProbeV1,
  type SessionStatusSnapshotAnswerV1,
  type SessionStatusSnapshotV1,
} from '../wire.ts'
import { deriveSessionStatusViewModel, statusSurfaceFallback } from '../view-model.ts'

export interface SessionStatusCapabilityProbe {
  readonly available: boolean
  readonly reason: string | null
  readonly capabilities: readonly string[]
  /**
   * Push-subscription capability, probed separately from `snapshot`.
   * `false` (or `null` when the probe seam is absent) means manual refresh
   * only — never promise live updates.
   */
  readonly subscription: boolean | null
}

export interface SessionStatusRemoteFace {
  snapshot(input: { readonly sessionRef: string }): Promise<SessionStatusSnapshotAnswerV1>
  probe?(): Promise<SessionStatusProbeV1>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function probeSessionStatusRemote(host: unknown): SessionStatusCapabilityProbe {
  if (!isRecord(host)) {
    return {
      available: false,
      reason: 'sessionStatus remote is unavailable',
      capabilities: [],
      subscription: null,
    }
  }
  const remote = isRecord(host.sessionStatus) ? host.sessionStatus : host
  if (typeof remote.snapshot !== 'function') {
    return {
      available: false,
      reason: 'sessionStatus.snapshot is unavailable',
      capabilities: [],
      subscription: null,
    }
  }
  return {
    available: true,
    reason: null,
    capabilities: ['session-status'],
    subscription: null,
  }
}

/**
 * Live probe: calls the Remote `probe()` method when present so the
 * subscription capability comes from the owner declaration, not from a
 * structural guess. Absent/failed probe seams degrade to `null`.
 */
export async function probeSessionStatusRemoteLive(host: unknown): Promise<SessionStatusCapabilityProbe> {
  const base = probeSessionStatusRemote(host)
  if (!base.available || !isRecord(host)) return base
  const remote = (isRecord(host.sessionStatus) ? host.sessionStatus : host) as unknown as SessionStatusRemoteFace
  if (typeof remote.probe !== 'function') return base
  try {
    const parsed = parseSessionStatusProbe(await remote.probe())
    if (parsed === null) return base
    return {
      available: true,
      reason: null,
      capabilities: parsed.capabilities,
      subscription: parsed.subscription,
    }
  } catch {
    return base
  }
}

export function applySessionStatusClient(host: unknown): {
  readonly probe: SessionStatusCapabilityProbe
  readonly read: (sessionRef: string) => Promise<SessionStatusSnapshotV1>
  readonly surfaceFor: (seams: { readonly headerAvailable: boolean; readonly paneAvailable: boolean }) => ReturnType<typeof statusSurfaceFallback>
} {
  const probe = probeSessionStatusRemote(host)
  return {
    probe,
    surfaceFor: statusSurfaceFallback,
    async read(sessionRef: string) {
      if (!probe.available || !isRecord(host)) {
        return unavailableClientSnapshot(probe.reason ?? 'sessionStatus remote is unavailable')
      }
      const remote = (isRecord(host.sessionStatus) ? host.sessionStatus : host) as unknown as SessionStatusRemoteFace
      const answer = await remote.snapshot({ sessionRef })
      if (!answer.ok) {
        return unavailableClientSnapshot(answer.message)
      }
      return parseSessionStatusSnapshot(answer.snapshot) ?? unavailableClientSnapshot('snapshot failed validation')
    },
  }
}

export { deriveSessionStatusViewModel, statusSurfaceFallback }
