/**
 * Chat media node: folds a durable `media/ref` session event into one chat row.
 *
 * This is the client-side rendering contract for the Rich Media plugin. A
 * Host/domain owner emits `media/ref` when it wants a media card to appear in
 * the conversation transcript; this Definition never scans the event window,
 * never guesses media from adjacency, and never constructs URLs from refs.
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

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Appends one rich-media card to the chat transcript. */
    'media/ref': MediaRefEventData
  }
}

/** Renderer-ready data published to the chat view. */
export interface MediaNodeData {
  readonly mediaId: string
  readonly media: MediaRefV1
  readonly title: string
  readonly summary?: string
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
  update: (context, _match) => context.state,
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

/** Chat renderer for one media-ref node. */
export function MediaNodeView({ node }: ChatNodeViewProps<'media-ref'>) {
  return <RichMediaCard media={node.data.media} />
}

export default MediaNodeView
