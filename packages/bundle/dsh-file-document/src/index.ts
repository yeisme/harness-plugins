/**
 * @yeisme/dsh-file-document root entry.
 *
 * This package is a Workbench Core module skeleton for File/Document. It
 * exports the module descriptor and a minimal React panel; it does not own
 * filesystem state or document parsing.
 *
 * @module @yeisme/dsh-file-document
 */

export { fileDocumentModule } from './module.ts'
export { FileDocumentPanel } from './client/file-document-panel.tsx'
export type { FileDocumentPanelProps } from './client/file-document-panel.tsx'
