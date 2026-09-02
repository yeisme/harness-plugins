export {
  DRAMA_CONTEXT_SCHEMA,
  DRAMA_COMMAND_REQUEST_SCHEMA,
  DRAMA_WORKBENCH_HANDOFF_SCHEMA,
  DRAMA_COMMANDS,
  isSafeDramaRef,
  validateDramaContext,
  validateDramaCommandRequest,
  validateWorkbenchHandoff,
  probeDramaCapability,
  shouldRetryUnknownDramaResult,
} from './contracts.js'
export type {
  DramaCommandIdV1,
  DramaFreshnessV1,
  DramaContextV1,
  DramaCommandRequestV1,
  WorkbenchHandoffV1,
  DramaCommandResultKind,
  DramaCapabilityProbeV1,
} from './contracts.js'

export {
  parseDramaSelector,
  contextRevisionMatches,
  shouldResyncContext,
  resolveCurrentDramaContext,
} from './context.js'
export type { DramaSelectorKind, DramaSelectorResolution, DramaContextOwner } from './context.js'

export { handleDramaCommand, isDramaMutation } from './commands.js'
export type { DramaActionDescriptorV1, DramaCommandResultV1, DramaCommandHostOptions } from './commands.js'

export { DramaEventSession } from './events.js'
export type { DramaEventKind, DramaPushEventV1, DramaEventSessionState } from './events.js'

export {
  WORKBENCH_HANDOFF_INTENTS,
  digestWorkbenchHandoff,
  createWorkbenchHandoff,
  verifyWorkbenchHandoff,
} from './handoff.js'
export type { WorkbenchHandoffIntentV1, SignedWorkbenchHandoffV1 } from './handoff.js'

export {
  DRAMA_COMMAND_GROUP,
  DRAMA_FIRST_SUPPORT_PANES,
  DRAMA_SECONDARY_PANES,
  DRAMA_SHOW_CONTROL_PANES,
  createDirectorPreset,
  createShowControlPreset,
  createDramaCommandGroup,
  createDramaPaneViews,
  shouldExpandToShowControlRoom,
  DramaClientRegistry,
} from './panes.js'

export * from './show-control.js'
export type {
  DramaPaneId,
  DramaShowControlPaneId,
  DramaCommandEntryV1,
  DramaPaneViewV1,
  DramaPresetV1,
  DramaShowControlPresetV1,
  DramaClientRegistrationV1,
} from './panes.js'

export {
  resolveDramaBreakpoint,
  createDramaInteractionState,
  visibleDramaPanesForBreakpoint,
  canSubmitDramaCommand,
  applyDramaKey,
  announceDramaFocus,
} from './interaction.js'
export type {
  DramaFocusZone,
  DramaBreakpoint,
  DramaInteractionState,
  DramaKeyEventV1,
} from './interaction.js'

export { dramaHelpCopy, mapDramaCommandError, selectedDramaCommand, canRetryDramaResult } from './help.js'
export type { DramaHelpCopyV1, DramaErrorCopyV1 } from './help.js'

export {
  DRAMA_EVIDENCE_SCHEMA,
  DRAMA_EVIDENCE_KINDS,
  recordDramaEvidence,
  isRedactedDramaEvidence,
} from './evidence.js'
export type { DramaEvidenceKindV1, DramaEvidenceRecordV1 } from './evidence.js'

// Workbench AI drama bridge V2 — additive surface; V1 stays frozen above.
export {
  BRIDGE_V2_CONTRACT,
  BRIDGE_V2_DIRECTION,
  WORKBENCH_AGENT_SPATIAL_SURFACE,
  WORKBENCH_TARGET_APPLICATION,
  BRIDGE_V2_INTENTS,
  BRIDGE_V2_LENS_MAP,
  BRIDGE_V2_REASON_CODES,
  BRIDGE_V2_CANONICAL_FIELD_ORDER,
  BRIDGE_V2_NONCE_PATTERN,
  BRIDGE_V2_DIGEST_PATTERN,
  BRIDGE_V2_MIN_TTL_MS,
  BRIDGE_V2_MAX_TTL_MS,
  BRIDGE_V2_DEFAULT_TTL_MS,
  canonicalizeBridgeV2,
  digestBridgeV2,
  generateBridgeV2Nonce,
  validateWorkbenchAiDramaBridgeV2,
  createWorkbenchAiDramaBridgeV2,
} from './bridge-v2.js'
export type {
  BridgeV2Intent,
  BridgeV2ReasonCode,
  WorkbenchAiDramaBridgeV2,
  BridgeV2Validation,
  BridgeV2IssueInput,
  BridgeV2IssueResult,
} from './bridge-v2.js'

export {
  LEGACY_BRIDGE_COMPAT_WINDOW_RELEASES,
  LEGACY_BRIDGE_MODE,
  createLegacyBridgeAdapter,
} from './legacy-bridge-adapter.js'
export type {
  LegacyBridgeIssueInput,
  LegacyBridgeAdapterResultV1,
  LegacyBridgeAdapter,
} from './legacy-bridge-adapter.js'

export {
  DRAMA_BRIDGE_EVIDENCE_SCHEMA,
  BRIDGE_EVIDENCE_KINDS,
  recordDramaBridgeEvidence,
  createBridgeEvidenceEmitter,
  isRedactedDramaBridgeEvidence,
} from './bridge-evidence.js'
export type {
  BridgeEvidenceKind,
  BridgeEvidenceSink,
  BridgeEvidenceEmitter,
  DramaBridgeEvidenceRecordV1,
} from './bridge-evidence.js'

export {
  BRIDGE_CAPABILITY_FRESHNESS_MS,
  createWorkbenchBridgeTargetRegistry,
  probeWorkbenchBridgeCapability,
  createWorkbenchLaunchProvider,
} from './bridge-launch.js'
export type {
  WorkbenchBridgeTargetEntryV1,
  WorkbenchBridgeTargetRegistration,
  WorkbenchBridgeTargetRegistry,
  WorkbenchBridgeCapability,
  WorkbenchLaunchDescriptorV2,
  WorkbenchBridgeIssuance,
  WorkbenchBridgeConsumption,
  WorkbenchLaunchProvider,
  WorkbenchLaunchProviderIssueInput,
  WorkbenchLaunchProviderOptions,
} from './bridge-launch.js'

export {
  BRIDGE_V2_FIXTURE_VERSION,
  BRIDGE_FIXTURE_BASE_INPUT,
  BRIDGE_FIXTURE_NOW_MS,
  BRIDGE_FIXTURE_NONCE,
  BRIDGE_FIXTURE_TARGET,
  buildBridgeFixtureEnvelope,
  evaluateBridgeV2Validate,
  evaluateBridgeV2Issue,
  evaluateBridgeV2Consume,
  evaluateBridgeV2Ingress,
  evaluateBridgeCapabilityFixture,
  resolveBridgeFixtureTarget,
  parseBridgeFixtureManifest,
  parseBridgeFixtureCase,
  runBridgeFixtureCase,
} from './bridge-conformance.js'
export type {
  BridgeFixtureKind,
  BridgeFixtureActor,
  BridgeFixtureCase,
  BridgeFixtureManifest,
  BridgeIngressOwnerSnapshot,
} from './bridge-conformance.js'

export {
  OPC_SCENE_PACKAGE_SUMMARY_SCHEMA,
  OPC_SCENE_SUMMARY_FIXTURE_VERSION,
  OPC_SCENE_SUMMARY_FIXTURE,
  isSafeOpcSceneRef,
  validateOpcScenePackageSummary,
} from './opc-scene-summary.js'
export type {
  OpcScenePackageSummaryV1alpha1,
  OpcSceneActionDescriptorV1,
  OpcSceneExceptionFindingV1,
  OpcSceneExceptionKindV1,
  OpcSceneGateIdV1,
  OpcSceneGateStateV1,
  OpcSceneGateV1,
  OpcSceneFreshnessV1,
  OpcSceneSideEffectClassV1,
  OpcSceneAspectV1,
  OpcSceneDepthV1,
  OpcSceneReframeVariantV1,
  OpcSceneSkillRoleV1,
  OpcSceneEvidenceBlockV1,
  OpcSceneReceiptRefV1,
  OpcSceneDeliveryV1,
} from './opc-scene-summary.js'
