/**
 * @yeisme/dsh-file-document root entry.
 *
 * This package is the Workbench Core File/Document view. It exports the module
 * descriptor and safe tree/preview panel; it does not own filesystem state or
 * document parsing.
 *
 * @module @yeisme/dsh-file-document
 */

export { fileDocumentModule } from './module.ts'
export { FileDocumentPanel } from './client/file-document-panel.tsx'
export type { FileDocumentPanelProps } from './client/file-document-panel.tsx'
export { FILE_ENTRY_KINDS, isFileEntry, validateFileEntry } from './types.ts'
export type { FileEntryKind, FileEntryV1, FileEntryValidation } from './types.ts'
export { createFileTreeHostAdapter } from './file-tree-host.ts'
export type { FileTreeDirectoryEntryLike, FileTreeDirectoryListingLike, FileTreeHostAdapter, FileTreeListRequest } from './file-tree-host.ts'
export { useFileTree } from './client/use-file-tree.ts'
export type { FileTreeLoadStatus, UseFileTreeResult } from './client/use-file-tree.ts'
export {
  applyFileDocumentPaneViews,
  WORKSPACE_EXPLORER_VIEW_KIND,
  WORKSPACE_DOCUMENT_VIEW_KIND,
} from './client/pane-views.ts'
export type {
  FileDocumentPaneOptions,
  FileDocumentPaneSurface,
  PaneWorkbenchFace,
} from './client/pane-views.ts'
