/**
 * @yeisme/dsh-client-ui-interaction-space module face.
 *
 * 工件锚定的 agent 交互空间：锚点栏（selection-host 合同）、附着会话
 * （主选择不变量）、typed space directive、per-format 提案与
 * preview-before-mutate 应用。组装既有 seam，不复制 canonical state。
 *
 * @module @yeisme/dsh-client-ui-interaction-space
 */

export {
  ingestSpaceDirective,
  proposalPayloadBytes,
  SPACE_DIRECTIVE_KINDS,
  SPACE_PROPOSAL_FORMATS,
  SPACE_PROTOCOL_LIMITS,
  SpaceDirectiveSchema,
  SpaceProposalSchema,
  tableRangeAnchorDraft,
} from './contracts.ts'
export type {
  DirectiveIngestContext,
  DirectiveIngestResult,
  DirectiveRejection,
  DirectiveRejectionCode,
  SpaceDirectiveKind,
  SpaceDirectiveV1,
  SpaceProposalFormat,
  SpaceProposalPayloadV1,
  SpaceProposalV1,
} from './contracts.ts'
export {
  InteractionSpaceController,
} from './controller.ts'
export type {
  ComposerAdapterFace,
  InteractionSpaceDeps,
  InteractionSpaceSnapshot,
  OwnerDispatchFace,
  ProposalLifecycle,
  SpaceProposalState,
  SpaceSessionBindingFace,
  SpaceSessionPhase,
  SpaceSessionsFace,
  SpaceTimelineEntry,
  TimelineEntryKind,
} from './controller.ts'
export { InteractionSpaceView } from './view.tsx'
// --- Selection interaction V2（统一选区交互层） -----------------------------
export {
  SELECTION_INTERACTION_CAPABILITY_V2,
  SELECTION_CONTEXT_KINDS_V2,
  SELECTION_CONTEXT_SOURCES_V2,
  SELECTION_STABLE_DEBOUNCE_MS,
  V1_ACTION_ALIASES,
  resolveV1ActionAlias,
  validateSelectionActionDescriptor,
  validateSelectionContextV2,
} from './selection/contracts.ts'
export type {
  LocalizedLabelV2,
  SelectionActionDescriptorV2,
  SelectionActionIntentV2,
  SelectionActionOwner,
  SelectionContextKindV2,
  SelectionContextSourceV2,
  SelectionContextV2,
  SelectionDangerLevel,
  SelectionDefaultSlot,
  SelectionDescriptorRejection,
  SelectionVisibility,
  ShortcutDescriptorV2,
} from './selection/contracts.ts'
export {
  BUILTIN_CONTEXT_ORDERS,
  BUILTIN_SELECTION_ACTIONS,
  SELECTION_CAPABILITY_BATCH,
  SELECTION_CAPABILITY_CONVERSATION,
  SELECTION_CAPABILITY_EDIT,
  registerBuiltinSelectionActions,
} from './selection/builtin-actions.ts'
export {
  normalizeSelection,
  selectionStillValid,
  SELECTION_OPT_OUT_ATTRIBUTE,
} from './selection/normalizer.ts'
export type { NormalizedSelection, SelectionExclusionReason, SelectionObservation } from './selection/normalizer.ts'
export { SelectionActionRegistryV2 } from './selection/registry.ts'
export type { RegistrationResult, ResolvedActionView, ResolvedActions, ResolveOptions } from './selection/registry.ts'
export { selectionInteractionReducer } from './selection/reducer.ts'
export type { SelectionInteractionEvent, SelectionInteractionState, SelectionSurfaceKind } from './selection/reducer.ts'
export {
  attachSharedSelectionInteraction,
  getSharedSelectionInteraction,
  SelectionInteractionLayer,
  SELECTION_ACTIONS_STYLE_ID,
  SELECTION_NARROW_VIEWPORT_PX,
} from './selection/layer.ts'
export type {
  ExternalContextFacts,
  IntentHandlerResult,
  IntentSurface,
  LayerContextPublisher,
  SelectionInteractionLayerOptions,
} from './selection/layer.ts'
