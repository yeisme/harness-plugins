/**
 * Session status service: probe each owner source independently and
 * publish a bounded snapshot. Missing sources stay unavailable.
 */

import { assembleSessionStatusSnapshot, unavailableSnapshot } from './projection.ts'
import { parseSafeSessionRef } from './schema.ts'
import type {
  SessionIdentityV1,
  SessionRuntimeSummaryV1,
  SessionStatusFailureV1,
  SessionStatusSnapshotOkV1,
  SessionStatusSnapshotV1,
} from './types.ts'
import { SESSION_STATUS_SPEC_VERSION } from './types.ts'
import type { ProviderLimitAdapter, TokenMeterFacts } from './projection.ts'

export interface SessionStatusLookup {
  identity?(sessionRef: string): SessionIdentityV1 | null
  runtime?(sessionRef: string): SessionRuntimeSummaryV1 | null
  tokenMeter?(sessionRef: string): TokenMeterFacts | null
}

export interface SessionStatusServiceOptions {
  readonly lookup?: SessionStatusLookup
  readonly adapters?: readonly ProviderLimitAdapter[]
  readonly now?: () => Date
}

export class SessionStatusService {
  private revision = 0
  private readonly lookup: SessionStatusLookup
  private readonly adapters: readonly ProviderLimitAdapter[]
  private readonly now: () => Date

  constructor(options: SessionStatusServiceOptions = {}) {
    this.lookup = options.lookup ?? {}
    this.adapters = options.adapters ?? []
    this.now = options.now ?? (() => new Date())
  }

  snapshot(input: { readonly sessionRef: string }): SessionStatusSnapshotOkV1 | SessionStatusFailureV1 {
    let sessionRef: string
    try {
      sessionRef = parseSafeSessionRef(input.sessionRef)
    } catch {
      return {
        ok: false,
        code: 'invalid_session_ref',
        message: 'Session ref is not a safe opaque identifier',
      }
    }

    const identity = this.lookup.identity?.(sessionRef) ?? {
      sessionRef,
      label: sessionRef.slice(0, 12),
      lifecycle: 'unknown' as const,
    }
    const runtime = this.lookup.runtime?.(sessionRef) ?? undefined
    const tokenMeter = this.lookup.tokenMeter?.(sessionRef) ?? undefined
    this.revision += 1
    let snapshot: SessionStatusSnapshotV1
    try {
      snapshot = assembleSessionStatusSnapshot({
        session: identity,
        runtime,
        tokenMeter,
        adapters: this.adapters,
        generatedAt: this.now().toISOString(),
        revision: this.revision,
      })
    } catch {
      // A ref that passes the shape check but carries credential-shaped or
      // otherwise forbidden text (or a source row that does) must degrade to
      // a typed failure, never a throw across the wire.
      return {
        ok: false,
        code: 'invalid_session_ref',
        message: 'Session ref is not a safe opaque identifier',
      }
    }
    return {
      ok: true,
      specVersion: SESSION_STATUS_SPEC_VERSION,
      snapshot,
    }
  }

  /**
   * Advance the revision clock after an owner source change notification.
   * Snapshots stay live-read; this keeps the revision honest for consumers
   * comparing revisions across reads.
   */
  noteSourceChange(): void {
    this.revision += 1
  }

  unavailable(sessionRef: string, reason: string): SessionStatusSnapshotV1 {
    return unavailableSnapshot(sessionRef, reason, this.now().toISOString())
  }
}
