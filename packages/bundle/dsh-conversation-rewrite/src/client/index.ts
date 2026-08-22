/**
 * DSH Conversation Rewrite browser entry.
 *
 * 直接复用 `@yeisme/dsh-client-ui-conversation-rewrite/client` 的 slot 注册与
 * controller；本文件只做 re-export，不复制任何业务状态。
 *
 * @module @yeisme/dsh-conversation-rewrite/client
 */

export {
  apply,
  inject,
  ChatRewriteController,
  RetryButton,
  EditInlineEditor,
  makeRetryAction,
  makeEditAction,
  computeEditTarget,
  computeRetryTarget,
  previousTurnEndSeq,
  textOfContent,
  en,
  NS,
  zh,
} from '@yeisme/dsh-client-ui-conversation-rewrite/client'
export type {
  ChatRewriteHost,
  ChatRewritePhase,
  ChatRewriteViewState,
  ConversationRewriteKey,
  EditActionProps,
  EditInlineEditorProps,
  RetryActionProps,
  RetryButtonProps,
  RewriteDecision,
  RewriteDisableReason,
  RewriteTarget,
  UserActionOwnerProps,
} from '@yeisme/dsh-client-ui-conversation-rewrite/client'
