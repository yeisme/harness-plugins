/**
 * Chat media node: folds durable `media/ref` session events into one chat row.
 *
 * This is the client-side rendering contract for the Rich Media plugin. A
 * Host/domain owner emits `media/ref` when it wants a media card to appear in
 * the conversation transcript; `media/ref/update` replaces the media payload
 * of the same card, and `media/ref/remove` folds the card into a removed
 * tombstone. This Definition never scans the event window, never guesses media
 * from adjacency, and never constructs URLs from refs.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import type {
  ChatConversationViewNode,
  ConversationLocation,
  ConversationNodeContext,
  ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatNodeViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { MediaRefV1 } from '../host/types.ts'
import { RichMediaCard } from './media-card.tsx'

/** Durable payload for one media card in the session log. */
export interface MediaRefEventData {
  /** Stable business id shared by every update of the same media card. */
  mediaId: string
  /** Validated safe media reference. */
  media: MediaRefV1
  /** Safe display title for the chat row. */
  title: string
  /** Bounded safe summary shown under the title. */
  summary?: string
}

/** Durable payload replacing the media of one existing media card. */
export interface MediaRefUpdateEventData {
  /** Stable business id of the media card being updated. */
  mediaId: string
  /** Validated safe media reference replacing the previous one. */
  media: MediaRefV1
  /** Safe replacement title; absent keeps the previous title. */
  title?: string
  /** Bounded safe replacement summary; absent keeps the previous summary. */
  summary?: string
}

/** Durable payload marking one existing media card as removed. */
export interface MediaRefRemoveEventData {
  /** Stable business id of the media card being removed. */
  mediaId: string
  /** Bounded safe reason shown on the removed row. */
  reason?: string
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Appends one rich-media card to the chat transcript. */
    'media/ref': MediaRefEventData
    /** Replaces the media payload of an existing rich-media card. */
    'media/ref/update': MediaRefUpdateEventData
    /** Marks an existing rich-media card as removed. */
    'media/ref/remove': MediaRefRemoveEventData
  }
}

/** Renderer-ready data published to the chat view. */
export interface MediaNodeData {
  readonly mediaId: string
  readonly media: MediaRefV1
  readonly title: string
  readonly summary?: string
  /** True once a `media/ref/remove` event folded into this node. */
  readonly removed?: boolean
  /** Bounded safe removal reason when `removed` is true. */
  readonly removalReason?: string
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    'media-ref': MediaNodeData
  }
}

function locationOf(context: ConversationNodeContext<MediaNodeData>): ConversationLocation {
  return context.start?.location ?? context.matches[0]?.location ?? { kind: 'unresolved' }
}

/**
 * The session-event union arrives from the runtime's `@deepseek-ai/dsh-session`
 * instance. The `SessionEventMap` augmentation above extends it with the
 * `media/ref` family, but pnpm may resolve several same-version instances of
 * that package across the workspace graph, so the runtime's union can lack the
 * augmented keys at compile time. Widen locally instead of relying on the
 * augmentation reaching every instance; the runtime behavior is unchanged.
 */
type MediaRefSessionEvent =
  | { readonly type: 'media/ref'; readonly data: MediaRefEventData }
  | { readonly type: 'media/ref/update'; readonly data: MediaRefUpdateEventData }
  | { readonly type: 'media/ref/remove'; readonly data: MediaRefRemoveEventData }

const narrowMediaRefEvent = (event: { readonly type: string }): MediaRefSessionEvent | undefined =>
  event.type === 'media/ref' || event.type === 'media/ref/update' || event.type === 'media/ref/remove'
    ? event as MediaRefSessionEvent
    : undefined

export const mediaNodeDefinition: ConversationNodeDefinition<MediaNodeData> = {
  kind: 'media-ref',
  target: 'chat',
  match: (incoming) => {
    const event = narrowMediaRefEvent(incoming)
    if (event === undefined) return null
    if (event.type === 'media/ref') {
      return { id: event.data.mediaId, role: 'start' }
    }
    return { id: event.data.mediaId, role: 'update' }
  },
  start: (_context, match) => {
    const event = narrowMediaRefEvent(match.event)
    if (event?.type !== 'media/ref') throw new Error('media-ref requires media/ref start')
    return {
      mediaId: event.data.mediaId,
      media: event.data.media,
      title: event.data.title,
      ...event.data.summary === undefined ? {} : { summary: event.data.summary },
    }
  },
  update: (context, match) => {
    const state = context.state
    if (state === undefined) return state
    const event = narrowMediaRefEvent(match.event)
    if (event === undefined) return state
    if (event.type === 'media/ref/update') {
      const data = event.data
      return {
        ...state,
        media: data.media,
        ...data.title === undefined ? {} : { title: data.title },
        ...data.summary === undefined ? {} : { summary: data.summary },
      }
    }
    if (event.type === 'media/ref/remove') {
      const data = event.data
      return {
        ...state,
        removed: true,
        ...data.reason === undefined ? {} : { removalReason: data.reason },
      }
    }
    return state
  },
  publication: () => 'immediate',
  buildViewNode: (context): ChatConversationViewNode | null => {
    if (context.state === undefined) return null
    return {
      key: context.key,
      kind: 'media-ref',
      id: context.id,
      target: 'chat',
      anchorSeq: context.start?.event.seq ?? context.matches[0]?.event.seq ?? 0,
      location: locationOf(context),
      visibility: 'visible',
      data: context.state,
    }
  },
}

export interface MediaNodeViewProps extends ChatNodeViewProps<'media-ref'> {
  readonly onOpenInPane?: ((media: MediaRefV1) => void) | undefined
}

/** Chat renderer for one media-ref node. */
export function MediaNodeView({ node, onOpenInPane }: MediaNodeViewProps) {
  const data = node.data
  if (data.removed === true) {
    return (
      <p data-dsh-rich-media-removed="true">
        <del>{data.title}</del>
        {data.removalReason !== undefined && data.removalReason.length > 0 ? ` \u2014 ${data.removalReason}` : ''}
      </p>
    )
  }
  return <RichMediaCard media={data.media} onOpenInPane={onOpenInPane} />
}

export default MediaNodeView
