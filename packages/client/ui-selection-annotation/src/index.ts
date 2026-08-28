/**
 * @yeisme/dsh-client-ui-selection-annotation root entry.
 *
 * Package-root surface for workbench embedding and tests: anchor utilities,
 * normalized image math, compact composer seam, approval panel controller and
 * the React annotation canvas. The DSH Web graft entry lives under `./client`.
 *
 * @module @yeisme/dsh-client-ui-selection-annotation
 */

export {
  COMPOSER_HISTORY_LIMIT,
  COMPOSER_ROWS_MAX,
  COMPOSER_ROWS_MIN,
  COMPOSER_WIDTH_DEFAULT,
  COMPOSER_WIDTH_MAX,
  COMPOSER_WIDTH_MIN,
  CompactComposerController,
  anchorTitleFor,
} from './client/composer.ts'
export type {
  ComposerAdapter,
  ComposerSendInput,
  ComposerState,
  ComposerStatus,
  CompactComposerOptions,
  ContextCard,
  SubmitResult,
} from './client/composer.ts'

export {
  edgeAnchorSide,
  placeToolbar,
  TOOLBAR_EDGE_OFFSET_PX,
  TOOLBAR_GAP_PX,
} from './client/toolbar.ts'
export type { ToolbarAction, ToolbarPlacement } from './client/toolbar.ts'

export {
  ApprovalPanelController,
} from './client/approval.ts'
export type {
  ApprovalHunkAction,
  ApprovalPanelEvents,
  ApprovalPanelOptions,
  ApprovalPanelState,
  ApprovalRow,
  ApprovalServiceAdapter,
} from './client/approval.ts'

export {
  clampRegion,
  fromNormalized,
  pixelOffsetToNormalized,
  pointInRegion,
  regionCenter,
  roundTripRegion,
  toNormalized,
} from './client/image-region.ts'
export type { NormalizedPoint, PixelRect, PixelSize } from './client/image-region.ts'

export {
  captureFromSelection,
  resolveSelectionSourceRange,
  resolveSourceRange,
  selectionToAnchorDraft,
  SOURCE_HINT_ATTRIBUTES,
} from './client/dom-anchors.ts'
export type { SelectionAnchorContext, SelectionCapture, SourceRange } from './client/dom-anchors.ts'

export { AnnotationCanvas, CANVAS_MAX_MARKERS } from './client/AnnotationCanvas.tsx'
export type { AnnotationCanvasProps, CanvasMarker } from './client/AnnotationCanvas.tsx'

export { injectSelectionAnnotationStyles, SELECTION_ANNOTATION_STYLE_ID } from './client/styles.ts'
export { en, labelsFor, zh } from './client/locales.ts'
export type { SelectionAnnotationKey, SelectionAnnotationLabels } from './client/locales.ts'
