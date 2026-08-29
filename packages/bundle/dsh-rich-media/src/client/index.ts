/**
 * DSH Rich Media browser entry.
 *
 * Production uses Pane providers owned by the desktop workbench. The legacy
 * Rich Media Workbench remains exported for stories, but is not mounted into
 * the DSH sidebar and cannot create a second layout owner.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
export { apply } from './apply.ts'

export { RichMediaCard, selectSafeTranscriptCues } from './media-card.tsx'
export type { MediaSubtitleTrack, RichMediaCardLabels, RichMediaCardProps, MediaTranscriptCueV1, WaveformEnhancerHandleV1, WaveformEnhancerLoaderV1, WaveformEnhancerModuleV1, WaveformEnhancerMountV1 } from './media-card.tsx'
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
export { seedMediaPreview, listSeededMedia, subscribeSeededMedia, clearSeededMedia } from './preview-seed.ts'
export { CSV_PARSE_BUDGET, delimiterOfMediaType, parseDelimitedTable } from './preview/csv-parse.ts'
export type { CsvParseBudget, CsvParseResult, CsvTruncateReason } from './preview/csv-parse.ts'
export { MediaTextSourceRenderer, prettyJsonOrRaw, TEXT_FETCH_MAX, TEXT_LINE_RENDER_CAP, TEXT_WINDOW } from './preview/text-source.tsx'
export type { MediaTextSourceLabels, MediaTextSourceProps } from './preview/text-source.tsx'
export { MediaCsvRenderer } from './preview/csv-renderer.tsx'
export type { MediaCsvLabels, MediaCsvRendererProps } from './preview/csv-renderer.tsx'
export { MediaDocxRenderer, DOCX_BYTES_MAX, DOCX_HTML_MAX } from './preview/docx-renderer.tsx'
export type { MediaDocxLabels, MediaDocxRendererProps } from './preview/docx-renderer.tsx'
export { MediaSheetRenderer, SHEET_BYTES_MAX } from './preview/sheet-renderer.tsx'
export type { MediaSheetLabels, MediaSheetRendererProps, ParsedSheet } from './preview/sheet-renderer.tsx'
export { LocalTableGrid, clampRows, columnsFromHeaderRow, LOCAL_TABLE_BUDGET, tableResourceOf } from './preview/local-table.tsx'
export type { LocalTableGridProps } from './preview/local-table.tsx'
export { accessSource, isAbortError, urlSource } from './preview/sources.ts'
export type { BoundedSource } from './preview/sources.ts'
export { classifyFileEntry, documentPreviewKindOf, DOCX_MEDIA_TYPE, PPTX_MEDIA_TYPE, XLSSM_MEDIA_TYPE, XLSX_MEDIA_TYPE } from './preview/format-kinds.ts'
export type { DocumentPreviewKind, FileEntryClassification } from './preview/format-kinds.ts'
export {
  FILE_PREVIEW_DESCRIPTORS,
  mediaRefOfResource,
  previewBinaryNoticeDescriptor,
  previewCsvRendererDescriptor,
  previewDocxRendererDescriptor,
  previewPdfRendererDescriptor,
  previewSheetRendererDescriptor,
  previewTextRendererDescriptor,
  registerFilePreviewRenderers,
} from './preview/descriptors.tsx'
export const name = 'dsh-rich-media'
export const inject = ['slots', 'conversationEvents'] as const
