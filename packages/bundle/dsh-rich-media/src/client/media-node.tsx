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

export const mediaNodeDefinition: ConversationNodeDefinition<MediaNodeData> = {
  kind: 'media-ref',
  target: 'chat',
  match: (event) => {
    if (event.type === 'media/ref') {
      return { id: event.data.mediaId, role: 'start' }
    }
    if (event.type === 'media/ref/update' || event.type === 'media/ref/remove') {
      return { id: event.data.mediaId, role: 'update' }
    }
    return null
  },
  start: (_context, match) => {
    if (match.event.type !== 'media/ref') throw new Error('media-ref requires media/ref start')
    return {
      mediaId: match.event.data.mediaId,
      media: match.event.data.media,
      title: match.event.data.title,
      ...match.event.data.summary === undefined ? {} : { summary: match.event.data.summary },
    }
  },
  update: (context, match) => {
    const state = context.state
    if (state === undefined) return state
    if (match.event.type === 'media/ref/update') {
      const data = match.event.data
      return {
        ...state,
        media: data.media,
        ...data.title === undefined ? {} : { title: data.title },
        ...data.summary === undefined ? {} : { summary: data.summary },
      }
    }
    if (match.event.type === 'media/ref/remove') {
      const data = match.event.data
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
