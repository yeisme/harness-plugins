/**
 * @yeisme/dsh-client-ui-conversation-rewrite-core node entry。
 *
 * 零 React、零 DOM、零 DSH runtime 依赖的 host-neutral rewrite core：
 * stable boundary 决策、typed owner outcome 与分阶段 mutation controller。
 * Shared contract fixtures 在 `./testing` 子路径发布。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite-core
 */

export type {
  RewriteCapabilitiesV2,
  RewriteContentPartV2,
  RewriteConversationSnapshotV2,
  RewriteDecisionV2,
  RewriteDisableReasonV2,
  RewriteKindV2,
  RewriteMessageKindV2,
  RewriteMessageV2,
  RewriteTargetV2,
} from './types.ts'

export {
  computeRetryTargetV2,
  computeUserTurnTargetV2,
  previousTurnEndSeqV2,
  textOfRewriteContentV2,
} from './boundary.ts'

export {
  accepted,
  normalizeRewriteSafeSummary,
  rejected,
  unknownOutcome,
  type RewriteMutationOutcomeV2,
} from './outcome.ts'

export {
  ConversationRewriteControllerV2,
  type RewriteFailureStageV2,
  type RewriteForkValueV2,
  type RewriteMutationHostV2,
  type RewriteOperationPhaseV2,
  type RewriteOperationSnapshotStoreV2,
  type RewriteOperationStateV2,
  type RewriteRunRequestV2,
  type RewriteUnitValueV2,
} from './controller.ts'
