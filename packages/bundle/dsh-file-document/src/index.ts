/**
 * @yeisme/dsh-file-document root entry.
 *
 * This package is the Workbench Core File/Document view. It exports the module
 * descriptor and safe tree/preview panel; it does not own filesystem state or
 * document parsing. Client components live behind the `./client` subpath so
 * the Node-side Cordis entry never pulls browser-only UI dependencies.
 *
 * @module @yeisme/dsh-file-document
 */

export { fileDocumentModule } from './module.ts'
export { FILE_ENTRY_KINDS, isFileEntry, validateFileEntry } from './types.ts'
export type { FileEntryKind, FileEntryV1, FileEntryValidation } from './types.ts'
export { createFileTreeHostAdapter } from './file-tree-host.ts'
export type { FileTreeDirectoryEntryLike, FileTreeDirectoryListingLike, FileTreeHostAdapter, FileTreeListRequest } from './file-tree-host.ts'

/** No-op Host lifecycle. Browser UI lives in `./client`. */
export function apply(): void {}
