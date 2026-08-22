/**
 * @yeisme/dsh-desktop-workbench client entry.
 *
 * Production apply registers contextual Pane view providers. Legacy shell and
 * sidebar exports remain available for one RC to keep story/demo imports stable,
 * but are not mounted by the bundle.
 *
 * @module @yeisme/dsh-desktop-workbench/client
 */

export {
  DesktopWorkbenchShell,
  FilePane,
  GlobalSearch,
  NotificationCenter,
  SessionSidebar,
  type DesktopWorkbenchShellProps,
  type FilePaneProps,
  type GlobalSearchProps,
  type NotificationCenterProps,
  type SessionSidebarProps,
} from '@yeisme/dsh-client-ui-desktop-workbench/client'
export type {
  DshSessionManagerSeams,
  SessionForkReceiptV1,
  SessionManagerHostV1,
  SessionMutationReceiptV1,
  SessionMutationStatus,
  SessionSummaryV1,
} from '@yeisme/dsh-session-manager'

export { ComposedDesktopWorkbench } from './composed-workbench.tsx'
export type { ComposedDesktopWorkbenchProps } from './composed-workbench.tsx'

export { TerminalPane } from '@yeisme/dsh-client-ui-desktop-workbench/client'
export type { TerminalPaneProps } from '@yeisme/dsh-client-ui-desktop-workbench/client'

export { apply, inject, DesktopWorkbenchClientPlugin } from './apply.ts'
export { default } from './apply.ts'
