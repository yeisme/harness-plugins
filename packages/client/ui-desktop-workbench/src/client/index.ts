/**
 * @yeisme/dsh-client-ui-desktop-workbench client entry.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

export { DesktopWorkbenchShell } from './desktop-workbench-shell.tsx'
export type { DesktopWorkbenchShellProps } from './desktop-workbench-shell.tsx'

export { SessionSidebar } from './session-sidebar.tsx'
export type { SessionSidebarProps, SessionLineageBadge } from './session-sidebar.tsx'

export { FilePane } from './file-pane.tsx'
export type { FilePaneProps } from './file-pane.tsx'

export { FileOpenPane } from './file-open-pane.tsx'
export type { FileOpenPaneProps } from './file-open-pane.tsx'

export { isMarkdownEntry, renderMarkdown, escapeHtml } from './file-markdown.ts'

export { GitPane } from './git-pane.tsx'
export type { GitDiffV1, GitHostFace, GitMutationReceiptV1, GitPaneProps, GitStatusFileV1, GitStatusV1 } from './git-pane.tsx'

export { TerminalPane } from './terminal-pane.tsx'
export type { TerminalPaneProps } from './terminal-pane.tsx'

export { NotificationCenter } from './notification-center.tsx'
export type { NotificationCenterProps } from './notification-center.tsx'

export { GlobalSearch } from './global-search.tsx'
export type { GlobalSearchProps } from './global-search.tsx'
