/**
 * DSH Rich Media browser entry.
 *
 * Production uses Pane providers owned by the desktop workbench. The legacy
 * Rich Media Workbench remains exported for stories, but is not mounted into
 * the DSH sidebar and cannot create a second layout owner.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { MediaNodeView, mediaNodeDefinition } from './media-node.tsx'

export { RichMediaCard } from './media-card.tsx'
export type { MediaSubtitleTrack, RichMediaCardLabels, RichMediaCardProps } from './media-card.tsx'
export { MediaPreviewPane } from './media-preview-pane.tsx'
export type { MediaPreviewPaneProps } from './media-preview-pane.tsx'
export { richMediaWorkbenchModule } from '../module.ts'
export { RichMediaWorkbench } from './workbench.tsx'
export type { RichMediaWorkbenchExtraProps, RichMediaWorkbenchProps } from './workbench.tsx'
export { MediaCompareView, MediaZoomOverlay, mediaGalleryKey } from './media-gallery.tsx'
export { MediaLibraryBody, MediaLibraryRow, libraryIntent, windowRange } from './media-library.tsx'
export type { MediaLibraryBodyProps, MediaLibraryLabels, MediaLibraryStatus } from './media-library.tsx'
export { createMediaLibraryView, createMediaResourceView, registerMediaPaneViews } from './pane-views.tsx'
export { MediaLifecycleController, MediaLifecycleError } from './media-lifecycle.ts'
export type { BoundedMediaMemory, MediaLifecyclePhase } from './media-lifecycle.ts'
export { MediaImageRenderer, MediaCompareRenderer, MediaPlaybackRenderer, canPlayNatively, playbackMode, prefersReducedMotion, pixelsOf, rejectUnsafePlayback, IMAGE_PIXEL_BUDGET } from './media-renderers.tsx'
export type { CompareItem, CompareMode, ImageFitMode, ImageRotation, LazyEnhancerLoader, MediaImageRendererLabels, MediaPlaybackRendererLabels } from './media-renderers.tsx'
export type { MediaPaneSurface, MediaPaneViewDeps, PaneLocalProps } from './pane-views.tsx'
export type { MediaGalleryItem } from './media-gallery.tsx'
export { MediaNodeView, mediaNodeDefinition } from './media-node.tsx'
export type { MediaNodeData, MediaRefEventData, MediaRefRemoveEventData, MediaRefUpdateEventData } from './media-node.tsx'
export { NS, en, zh } from './locales.ts'
export type { RichMediaKey } from './locales.ts'
export { MEDIA_HOST_CONTEXT_KEY, createMediaHostPlaceholder, isMediaHostV1 } from '../host/types.ts'
export type { MediaHostV1, MediaRefV1 } from '../host/types.ts'

export const name = 'dsh-rich-media'
export const inject = ['conversationEvents'] as const

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
  installMediaNode(ctx)
  return () => {}
}
