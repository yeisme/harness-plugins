import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { MediaNodeView, mediaNodeDefinition } from './media-node.tsx'

function asDisposer(value: unknown): () => void {
  return typeof value === 'function' ? () => { (value as () => void)() } : () => {}
}

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext): Promise<() => void> {
  const disposeEvent = asDisposer(ctx.conversationEvents.register(mediaNodeDefinition))
  const disposeSlot = asDisposer(ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'media-ref',
    locale: 'conversation',
  }, MediaNodeView)))
  return () => {
    disposeSlot()
    disposeEvent()
  }
}
