/**
 * `sessionStatus` Typert Remote service face.
 *
 * Thin forwarder: the SessionStatusService owns per-source degradation and
 * the revision clock. Inputs are re-validated at the wire boundary; typed
 * failures return as-is — never retried, never substituted by this layer.
 *
 * @module @yeisme/dsh-session-status-host/remote
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { parseSessionStatusSnapshot } from './schema.ts'
import type { SessionStatusService } from './service.ts'
import {
  SESSION_STATUS_REMOTE_SERVICE_KEY,
  SESSION_STATUS_SPEC_VERSION,
  type SessionStatusFailureV1,
  type SessionStatusSnapshotOkV1,
} from './types.ts'

/** Capability declaration returned by the `probe` Remote method. */
export interface SessionStatusProbeV1 {
  readonly ok: true
  readonly specVersion: typeof SESSION_STATUS_SPEC_VERSION
  readonly capabilities: readonly ['session-status']
  /**
   * Wire-level push subscription. Always false today: the host keeps the
   * revision clock fresh from the projection change feed, but clients must
   * re-read `snapshot` — no streaming seam is claimed.
   */
  readonly subscription: false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidRef(message: string): SessionStatusFailureV1 {
  return { ok: false, code: 'invalid_session_ref', message }
}

/**
 * Cordis-mounted `sessionStatus` Remote. Construction registers the service
 * (TypertRemoteService base); unload of the owner fiber unregisters it.
 */
export class SessionStatusRemoteService extends TypertRemoteService {
  private readonly service: SessionStatusService

  constructor(ctx: Context, service: SessionStatusService) {
    super(ctx, SESSION_STATUS_REMOTE_SERVICE_KEY)
    this.service = service
  }

  /** Capability probe: separate from `snapshot`, honest about streaming. */
  @Remote
  async probe(): Promise<SessionStatusProbeV1> {
    return {
      ok: true,
      specVersion: SESSION_STATUS_SPEC_VERSION,
      capabilities: ['session-status'],
      subscription: false,
    }
  }

  /** Bounded safe snapshot for one session ref; failures are typed. */
  @Remote
  async snapshot(input: unknown): Promise<SessionStatusSnapshotOkV1 | SessionStatusFailureV1> {
    if (!isRecord(input) || typeof input.sessionRef !== 'string') {
      return invalidRef('snapshot requires a sessionRef string')
    }
    try {
      const result = this.service.snapshot({ sessionRef: input.sessionRef })
      if (!result.ok) return result
      return {
        ok: true,
        specVersion: SESSION_STATUS_SPEC_VERSION,
        snapshot: parseSessionStatusSnapshot(result.snapshot),
      }
    } catch {
      // Last-resort wire guard: no exception crosses the Remote boundary.
      return {
        ok: false,
        code: 'source_unavailable',
        message: 'Session status snapshot is unavailable',
      }
    }
  }
}

export function sessionStatusRemoteMarkers(service: SessionStatusRemoteService) {
  return remoteMethods(service)
}
