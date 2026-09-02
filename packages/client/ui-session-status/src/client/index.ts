/**
 * Probe-first session status client. Missing remotes stay unavailable.
 */

import {
  parseSessionStatusSnapshot,
  unavailableClientSnapshot,
  type SessionStatusSnapshotAnswerV1,
  type SessionStatusSnapshotV1,
} from '../wire.ts'
import { deriveSessionStatusViewModel, statusSurfaceFallback } from '../view-model.ts'

export interface SessionStatusCapabilityProbe {
  readonly available: boolean
  readonly reason: string | null
  readonly capabilities: readonly string[]
}

export interface SessionStatusRemoteFace {
  snapshot(input: { readonly sessionRef: string }): Promise<SessionStatusSnapshotAnswerV1>
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
    }
  }
  const remote = isRecord(host.sessionStatus) ? host.sessionStatus : host
  if (typeof remote.snapshot !== 'function') {
    return {
      available: false,
      reason: 'sessionStatus.snapshot is unavailable',
      capabilities: [],
    }
  }
  return {
    available: true,
    reason: null,
    capabilities: ['session-status'],
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
