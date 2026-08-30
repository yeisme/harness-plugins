/**
 * @yeisme/dsh-personal-radar — DSH Personal Drama Radar host contracts.
 *
 * Typed /drama radar intents, capability probe, lane intersection, receipt
 * reconcile, badge/pane reducers, Workbench handoff, and honest degradation.
 * See the child OpenSpec change `dsh-personal-radar-pane-v1` for the frozen
 * owner split: Harness Plugins renders the entry points only; Radar owns all
 * canonical state.
 *
 * @module @yeisme/dsh-personal-radar
 */

export {
  RADAR_HANDOFF_SPEC,
  RADAR_INTENT_SCHEMA,
  RADAR_PROJECTION_SCHEMA,
  RADAR_RECEIPT_SCHEMA,
  RADAR_WORKBENCH_HANDOFF_SCHEMA,
  RADAR_PROPOSAL_SCHEMA,
  RADAR_EVIDENCE_SCHEMA,
  RADAR_LANES,
  RADAR_INTENT_KINDS,
  RADAR_STATUSES,
  RADAR_DISABLED_REASONS,
  isSafeRadarRef,
  isRadarLane,
  isRadarIntentKind,
  isRadarStatus,
  validateRadarIntent,
  validateRadarProjection,
  validateRadarReceipt,
  validateRadarWorkbenchHandoff,
  validateRadarProposalDraft,
  shouldAutoReplayRadarIntent,
} from './contracts.js'
export type {
  RadarLane,
  RadarIntentKind,
  RadarStatus,
  RadarDisabledReason,
  RadarIntentV1,
  RadarOpportunityProjectionV1,
  RadarProjectionV1,
  RadarReceiptOutcome,
  RadarActionReceiptV1,
  PersonalRadarOpportunityHandoffV1,
  RadarProposalStatus,
  RadarProposalDraftV1,
} from './contracts.js'

export {
  RADAR_FIXED_ARGV,
  isSafeRadarBinary,
  resolveRadarSpawn,
  dispatchRadarIntent,
} from './adapter.js'
export type {
  RadarAdapterConfigV1,
  RadarSpawnDescriptorV1,
  RadarMcpRequestV1,
  RadarRunnerResultV1,
  RadarRunner,
  RadarAdapterRejectReason,
  RadarAdapterResult,
} from './adapter.js'

export {
  RADAR_INTENT_OPERATIONS,
  validateRadarIntersection,
  isOperatorRefreshOnly,
} from './intersection.js'
export type {
  RadarOperationV1,
  RadarIntersectionReject,
  RadarIntersectionResult,
  RadarCapabilitySnapshotV1,
} from './intersection.js'

export { probeRadarCapability } from './probe.js'
export type {
  RadarCapabilitiesOutputV1,
  RadarProbeInputV1,
  RadarProbeCheckV1,
  RadarCapabilityProbeResultV1,
} from './probe.js'

export {
  recordRadarDispatch,
  reconcileRadarUnknown,
  isRadarReconcilePending,
} from './reconcile.js'
export type { RadarReconcileLookup, RadarReconcileLedgerV1, RadarReconcileLedgerEntryV1 } from './reconcile.js'

export { RADAR_COMMAND_USAGE, radarIdempotencyKey, parseRadarCommand } from './commands.js'
export type { RadarParseResult } from './commands.js'

export { summarizeRadarBadge, isRadarBadgeVisible, RADAR_STATUS_NEXT_ACTIONS } from './badge.js'
export type { RadarBadgeModelV1 } from './badge.js'

export {
  RADAR_MIN_COMPARE_WIDTH,
  createRadarPaneState,
  updateRadarPane,
  renderRadarPane,
} from './pane.js'
export type {
  RadarPaneView,
  RadarPaneStateV1,
  RadarPaneEventV1,
  RadarPaneKey,
} from './pane.js'

export {
  RADAR_HANDOFF_TTL_MS,
  createRadarWorkbenchHandoff,
  verifyRadarHandoffFreshness,
  createRadarProposalDraft,
} from './handoff.js'
export type { RadarHandoffInputV1, RadarHandoffOptionsV1, RadarProposalInputV1 } from './handoff.js'

export { RADAR_EVIDENCE_KINDS, isRedactedRadarEvidence, recordRadarEvidence } from './evidence.js'
export type { RadarEvidenceKindV1, RadarEvidenceRecordV1 } from './evidence.js'

export { createFakeRadarProvider, FAKE_RADAR_DEMO_PROJECTION } from './provider.js'
export type { FakeRadarOptionsV1, FakeRadarReceiptRecordV1, FakeRadarProvider } from './provider.js'
