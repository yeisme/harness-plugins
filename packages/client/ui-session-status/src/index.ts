/**
 * @yeisme/dsh-client-ui-session-status library face.
 */

export {
  SESSION_STATUS_SCHEMA_VERSION,
  SESSION_STATUS_SPEC_VERSION,
  parseSessionStatusSnapshot,
  unavailableClientSnapshot,
} from './wire.ts'
export type {
  LimitScope,
  SessionContextStatusV1,
  SessionIdentityV1,
  SessionLimitWindowV1,
  SessionLifecycle,
  SessionRuntimeSummaryV1,
  SessionStatusFreshness,
  SessionStatusOverall,
  SessionStatusSnapshotAnswerV1,
  SessionStatusSnapshotV1,
  SourceStatus,
} from './wire.ts'
export {
  contextTone,
  deriveSessionStatusViewModel,
  sessionStatusSurfaces,
  statusSurfaceFallback,
} from './view-model.ts'
export type {
  ContextTone,
  SessionStatusViewModel,
  StatusSurface,
} from './view-model.ts'
export { applySessionStatusClient, probeSessionStatusRemote } from './client/index.ts'
export type { SessionStatusCapabilityProbe } from './client/index.ts'
