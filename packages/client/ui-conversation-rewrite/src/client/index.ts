/**
 * DSH Web conversation rewrite 浏览器入口。
 *
 * 注册 assistant-actions 上的 Retry；当上游 `conversation.chat.user-actions`
 * slot 存在时，同时注册 Edit。所有注册都通过 ctx.effect / slots.inject 随插件卸载。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatRewriteHost } from './controller.ts'
import { ChatRewriteController } from './controller.ts'
import { makeEditAction } from './edit.tsx'
import { makeRetryAction } from './retry.tsx'
import { en, NS, zh } from './locales.ts'
import { bindForkBeforeMessage, hasUserActionsSlot } from './seams.ts'

export { ChatRewriteController } from './controller.ts'
export type { ChatRewriteHost, ChatRewritePhase, ChatRewriteViewState } from './controller.ts'
export { computeEditTarget, computeRetryTarget, disableReasonKey, previousTurnEndSeq, textOfContent } from './boundary.ts'
export type { RewriteDecision, RewriteDisableReason, RewriteTarget } from './boundary.ts'
export { makeEditAction, EditInlineEditor } from './edit.tsx'
export type { EditActionProps, EditInlineEditorProps } from './edit.tsx'
export { bindForkBeforeMessage, hasUserActionsSlot } from './seams.ts'
export type { ForkBeforeMessageHost, SlotSpecReader, UserActionOwnerProps } from './seams.ts'
export { makeRetryAction, RetryButton } from './retry.tsx'
export type { RetryActionProps, RetryButtonProps } from './retry.tsx'
export { lineageLabel, sessionLineageLabel } from './lineage.ts'
export type { RewriteLineageLabel, RewriteLineageSource, SessionLineageRow } from './lineage.ts'
export { en, NS, zh } from './locales.ts'
export type { ConversationRewriteKey } from './locales.ts'

export const name = 'client-ui-conversation-rewrite'
export const inject = ['slots', 'locale', 'sessions'] as const

function createHost(ctx: ClientContext): ChatRewriteHost {
  const forkBeforeMessage = bindForkBeforeMessage(ctx.sessions)
  return {
    fork: async (opts) => ctx.sessions.fork(opts.increaseTitle === undefined
      ? { sessionId: opts.sessionId, atSeq: opts.atSeq }
      : { sessionId: opts.sessionId, atSeq: opts.atSeq, increaseTitle: opts.increaseTitle }),
    prompt: async (sessionId, text) => {
      const binding = ctx.sessions.binding(sessionId)
      if (binding === undefined) throw new Error('child session binding unavailable')
      const result = await binding.session.prompt([{ type: 'text', text }], 'queue')
      if (!result.ok) throw result.error
      return result.value
    },
    open: (sessionId) => { ctx.sessions.open(sessionId) },
    ...forkBeforeMessage === undefined ? {} : { forkBeforeMessage },
  }
}

function installRetry(ctx: ClientContext, controller: ChatRewriteController): void {
  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'dsh-conversation-rewrite',
    locale: NS,
    order: 0,
  }, makeRetryAction(controller)))
}

function installEditWhenAvailable(ctx: ClientContext, controller: ChatRewriteController): void {
  if (!hasUserActionsSlot(ctx.slots)) return
  ctx.slots.inject('conversation.chat.user-actions', () => ctx.slots.register({
    name: 'conversation.chat.user-actions',
    id: 'dsh-conversation-rewrite',
    locale: NS,
    order: 0,
  }, makeEditAction(controller)))
}

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext): Promise<() => void> {
  const controller = new ChatRewriteController(createHost(ctx))
  ctx.effect(() => () => { controller.dispose() }, 'dsh-conversation-rewrite: controller lifecycle')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-conversation-rewrite: dictionaries')
  installRetry(ctx, controller)
  installEditWhenAvailable(ctx, controller)
  return () => {}
}
