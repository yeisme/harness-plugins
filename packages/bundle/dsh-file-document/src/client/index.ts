/**
 * @yeisme/dsh-file-document client face.
 *
 * @module @yeisme/dsh-file-document/client
 */
export { FileDocumentPanel } from './file-document-panel.tsx'
export type { FileDocumentPanelProps } from './file-document-panel.tsx'
export {
  applyFileDocumentPaneViews,
  WORKSPACE_EXPLORER_VIEW_KIND,
  WORKSPACE_DOCUMENT_VIEW_KIND,
} from './pane-views.ts'
export type {
  DocumentOpenKind,
  DocumentOpenRequest,
  DocumentOpenStateV1,
  FileDocumentPaneOptions,
  FileDocumentPaneSurface,
  PaneWorkbenchFace,
} from './pane-views.ts'
export {
  documentOpenReducer,
  EMPTY_DOCUMENT_OPEN_STATE,
  isDocumentOpenKey,
} from './document-open-state.ts'
export type { DocumentOpenAction } from './document-open-state.ts'
export { formatJsonTree } from './json-tree.ts'
export { useFileTree } from './use-file-tree.ts'
export type { FileTreeLoadStatus, UseFileTreeResult } from './use-file-tree.ts'
