/**
 * DSH Rich Media browser entry.
 *
 * The current slice registers a Rich Media Workbench through the official
 * `sidebar.footer.action` slot. It does not use DOM patches, global selectors,
 * or the reference project's private API. Conversation-node and ToolView media
 * renderers are reserved for later phases.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { MediaNodeView, mediaNodeDefinition } from './media-node.tsx'
import { NS, en, zh } from './locales.ts'
import { RichMediaWorkbench } from './workbench.tsx'

export { RichMediaCard } from './media-card.tsx'
export type { RichMediaCardProps } from './media-card.tsx'
export { RichMediaWorkbench } from './workbench.tsx'
export type { RichMediaWorkbenchExtraProps, RichMediaWorkbenchProps } from './workbench.tsx'
export { MediaNodeView, mediaNodeDefinition } from './media-node.tsx'
export type { MediaNodeData, MediaRefEventData } from './media-node.tsx'
export { NS, en, zh } from './locales.ts'
export type { RichMediaKey } from './locales.ts'

export const name = 'dsh-rich-media'
export const inject = ['slots', 'locale', 'conversationEvents'] as const

function installWorkbench(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-rich-media: dictionaries')
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'dsh-rich-media',
    locale: NS,
  }, RichMediaWorkbench))
}

function installMediaNode(ctx: ClientContext): void {
  ctx.conversationEvents.register(mediaNodeDefinition)
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'media-ref',
    locale: 'conversation',
  }, MediaNodeView))
}

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext): Promise<() => void> {
  installWorkbench(ctx)
  installMediaNode(ctx)
  return () => {}
}
