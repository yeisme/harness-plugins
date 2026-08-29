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
