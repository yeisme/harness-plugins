import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { MediaRefV1 } from '../host/types.ts'
import { MediaNodeView, mediaNodeDefinition, type MediaNodeViewProps } from './media-node.tsx'
import { seedMediaPreview } from './preview-seed.ts'

function asDisposer(value: unknown): () => void {
  return typeof value === 'function' ? () => { (value as () => void)() } : () => {}
}

function readService<T>(ctx: ClientContext, name: string): T | undefined {
  try {
    return (ctx as unknown as Record<string, T | undefined>)[name]
  } catch {
    return undefined
  }
}

interface ConversationEventsLike {
  register(definition: unknown): unknown
}

interface SlotsLike {
  inject(name: string, setup: () => unknown): unknown
  register(input: unknown, component: unknown): unknown
}

interface PaneWorkbenchLike {
  openView(request: unknown): void
}

function resolvePane(ctx: ClientContext): PaneWorkbenchLike | undefined {
  const fromProp = readService<PaneWorkbenchLike>(ctx, 'paneWorkbench')
  if (fromProp !== undefined && typeof fromProp.openView === 'function') return fromProp
  try {
    const candidate = (ctx as unknown as { get?: (name: never) => unknown }).get?.('paneWorkbench' as never) as PaneWorkbenchLike | undefined
    if (candidate !== undefined && typeof candidate.openView === 'function') return candidate
  } catch {
    // Optional until Desktop Workbench provides the overlay.
  }
  return undefined
}

function createMediaNodeView(openInPane: ((media: MediaRefV1) => void) | undefined) {
  return function BoundMediaNodeView(props: MediaNodeViewProps) {
    return createElement(MediaNodeView, { ...props, onOpenInPane: openInPane })
  }
}

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext): Promise<() => void> {
  const conversationEvents = readService<ConversationEventsLike>(ctx, 'conversationEvents')
  const slots = readService<SlotsLike>(ctx, 'slots')
  if (conversationEvents === undefined || typeof conversationEvents.register !== 'function') return () => {}
  if (slots === undefined || typeof slots.inject !== 'function' || typeof slots.register !== 'function') return () => {}
  const pane = resolvePane(ctx)
  const openInPane = pane === undefined ? undefined : (media: MediaRefV1) => {
    seedMediaPreview(media)
    pane.openView({
      kind: 'desktop.media',
      resourceKey: media.ref,
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: true,
      preview: true,
      title: media.title,
    })
  }
  const disposeEvent = asDisposer(conversationEvents.register(mediaNodeDefinition))
  const disposeSlot = asDisposer(slots.inject('conversation.chat.node', () => slots.register({
    name: 'conversation.chat.node',
    key: 'media-ref',
    locale: 'conversation',
  }, createMediaNodeView(openInPane))))
  return () => {
    disposeSlot()
    disposeEvent()
  }
}
