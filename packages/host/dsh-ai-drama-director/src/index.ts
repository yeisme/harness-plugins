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
  createDirectorPreset,
  createDramaCommandGroup,
  createDramaPaneViews,
  shouldExpandToShowControlRoom,
  DramaClientRegistry,
} from './panes.js'
export type {
  DramaPaneId,
  DramaCommandEntryV1,
  DramaPaneViewV1,
  DramaPresetV1,
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

export { dramaHelpCopy, mapDramaCommandError, selectedDramaCommand } from './help.js'
export type { DramaHelpCopyV1, DramaErrorCopyV1 } from './help.js'

export {
  DRAMA_EVIDENCE_SCHEMA,
  DRAMA_EVIDENCE_KINDS,
  recordDramaEvidence,
  isRedactedDramaEvidence,
} from './evidence.js'
export type { DramaEvidenceKindV1, DramaEvidenceRecordV1 } from './evidence.js'
