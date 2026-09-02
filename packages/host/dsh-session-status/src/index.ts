/**
 * Host plugin: sessionStatus Remote.
 *
 * Independent of tokenUsage. Context remaining never comes from the
 * process ledger. Missing owner sources stay unavailable.
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-session-status-host'
export const inject = [] as const

export function apply(_ctx: Context): void {
  // Probe-first: the Remote is constructed by hosts that already have
  // typed session identity. Without those seams the package still
  // exports the pure snapshot assembler for tests and TUI/Web clients.
}

const DshSessionStatusHostPlugin = { name, inject, apply }
export default DshSessionStatusHostPlugin

export { SessionStatusService } from './service.ts'
export type { SessionStatusLookup, SessionStatusServiceOptions } from './service.ts'
export {
  assembleSessionStatusSnapshot,
  collectLimits,
  contextTone,
  projectContext,
  unavailableSnapshot,
} from './projection.ts'
export type { ProviderLimitAdapter, SessionStatusSources, TokenMeterFacts } from './projection.ts'
export {
  parseSafeSessionRef,
  parseSessionStatusSnapshot,
  safeSessionRefSchema,
  sessionStatusSnapshotSchema,
} from './schema.ts'
export {
  SESSION_STATUS_LIMIT_BOUND,
  SESSION_STATUS_REMOTE_SERVICE_KEY,
  SESSION_STATUS_SCHEMA_VERSION,
  SESSION_STATUS_SPEC_VERSION,
} from './types.ts'
export type {
  LimitScope,
  SessionContextStatusV1,
  SessionIdentityV1,
  SessionLimitWindowV1,
  SessionRuntimeSummaryV1,
  SessionStatusFailureV1,
  SessionStatusFreshness,
  SessionStatusOverall,
  SessionStatusSnapshotOkV1,
  SessionStatusSnapshotV1,
  SourceStatus,
} from './types.ts'
