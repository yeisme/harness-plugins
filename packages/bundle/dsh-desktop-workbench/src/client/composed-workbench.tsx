/**
 * Composed Desktop Workbench.
 *
 * This component wires the session sidebar, file pane, terminal pane,
 * notification center, and Workbench Core registry into one DSH client face.
 * All domain state stays with DSH/owner services; this component only renders
 * safe projections.
 *
 * @module @yeisme/dsh-desktop-workbench/client
 */

import { useMemo } from 'react'
import {
  DesktopWorkbenchShell,
  FilePane,
  GlobalSearch,
  NotificationCenter,
  TerminalPane,
  type DesktopWorkbenchShellProps,
} from '@yeisme/dsh-client-ui-desktop-workbench/client'
import { sessionLineageLabel } from '@yeisme/dsh-client-ui-conversation-rewrite'
import type { SessionManagerHostV1, SessionSummaryV1 } from '@yeisme/dsh-session-manager'
import { resolveSessionManagerHost } from '@yeisme/dsh-session-manager'
import type { FileHostV1 } from '@yeisme/dsh-file-host'
import { createFileHostPlaceholder } from '@yeisme/dsh-file-host'
import type { TerminalHostV1, TerminalHostV2 } from '@yeisme/dsh-terminal-host'
import type { NotificationHostV1 } from '@yeisme/dsh-notify-host'
import { createNotificationHostPlaceholder } from '@yeisme/dsh-notify-host'
import { TerminalPanel, type TerminalPanelState } from '@yeisme/dsh-terminal'
import { createDesktopWorkbenchRegistry } from '../composed-registry.ts'

export interface ComposedDesktopWorkbenchProps {
  /**
   * Optional session manager host adapter. Falls back to the host- or
   * plugin-bound real service when one is live, then to the honest placeholder.
   */
  sessionHost?: SessionManagerHostV1 | undefined
  /** Optional file host adapter. */
  fileHost?: FileHostV1 | undefined
  /** Optional terminal host adapter. */
  terminalHost?: TerminalHostV1 | TerminalHostV2 | undefined
  /** Optional notification host adapter. */
  notificationHost?: NotificationHostV1 | undefined
  /** Optional terminal state projection used when no terminal host is wired. */
  terminalState?: TerminalPanelState | undefined
  /** Optional short terminal status. */
  terminalStatus?: string | undefined
  /** Called when a session is opened. */
  onOpenSession?: ((sessionId: string) => void) | undefined
  /** Called when a file is opened. */
  onOpenFile?: ((entry: import('@yeisme/dsh-file-document').FileEntryV1) => void) | undefined
  /** Optional status line. */
  status?: string | undefined
  /** Close the desktop overlay and return to the underlying DSH conversation. */
  onClose?: (() => void) | undefined
}

const FILE_TAB_ID = 'files'
const DOCUMENT_TAB_ID = 'documents'
const TERMINAL_TAB_ID = 'terminal'
const NOTIFICATION_TAB_ID = 'desktop-notifications'
const SEARCH_TAB_ID = 'desktop-search'
const MEDIA_TAB_ID = 'media'

export function ComposedDesktopWorkbench({
  sessionHost,
  fileHost,
  terminalHost,
  notificationHost,
  terminalState,
  terminalStatus,
  onOpenSession,
  onOpenFile,
  status,
  onClose,
}: ComposedDesktopWorkbenchProps) {
  const registry = useMemo(createDesktopWorkbenchRegistry, [])
  const tabs = registry.snapshot().tabs
  const effectiveSessionHost = sessionHost ?? resolveSessionManagerHost()
  const effectiveFileHost = fileHost ?? createFileHostPlaceholder()
  const effectiveNotificationHost = notificationHost ?? createNotificationHostPlaceholder()
  const lineageOf = useMemo(() => (session: SessionSummaryV1) => sessionLineageLabel(session), [])

  const renderTab: DesktopWorkbenchShellProps['renderTab'] = tab => {
    if (tab.id === FILE_TAB_ID || tab.id === DOCUMENT_TAB_ID) {
      return <FilePane host={effectiveFileHost} tabId={tab.id as 'files' | 'documents'} onOpenEntry={onOpenFile} />
    }
    if (tab.id === TERMINAL_TAB_ID) {
      if (terminalHost !== undefined) {
        return <TerminalPane host={terminalHost} />
      }
      return <TerminalPanel state={terminalState} status={terminalStatus} />
    }
    if (tab.id === NOTIFICATION_TAB_ID) {
      return <NotificationCenter host={effectiveNotificationHost} />
    }
    if (tab.id === SEARCH_TAB_ID) {
      return <GlobalSearch host={effectiveSessionHost} onOpenSession={onOpenSession} />
    }
    if (tab.id === MEDIA_TAB_ID) {
      return (
        <section aria-label="Media" data-dsh-media-panel>
          <header data-dsh-panel-heading>
            <div>
              <h2>媒体库</h2>
              <p>集中查看当前会话产生的图片、音频与其他媒体。</p>
            </div>
          </header>
          <div data-dsh-panel-empty>
            <strong>还没有媒体资源</strong>
            <span>会话生成或导入媒体后，安全预览会显示在这里。</span>
          </div>
        </section>
      )
    }
    if (tab.id === 'desktop-sessions') {
      return (
        <section aria-label="Session overview" data-dsh-media-panel>
          <header data-dsh-panel-heading>
            <div>
              <h2>会话概览</h2>
              <p>从左侧会话栏打开、搜索或管理工作区记录。</p>
            </div>
          </header>
          <div data-dsh-panel-empty>
            <strong>选择一个会话开始</strong>
            <span>会话详情和运行状态会在接入 Session Manager 后显示在这里。</span>
          </div>
        </section>
      )
    }
    return (
      <section aria-label={tab.title} data-dsh-media-panel>
        <header data-dsh-panel-heading>
          <div>
            <h2>{tab.title}</h2>
            <p>这个工作台视图正在等待对应服务接入。</p>
          </div>
        </header>
        <div data-dsh-panel-empty>
          <strong>{tab.title}尚未连接</strong>
          <span>服务可用后，该视图会自动显示内容。</span>
        </div>
      </section>
    )
  }

  return (
    <DesktopWorkbenchShell
      tabs={tabs}
      renderTab={renderTab}
      sessionHost={effectiveSessionHost}
      onOpenSession={onOpenSession}
      lineageOf={lineageOf}
      status={status}
      onClose={onClose}
    />
  )
}

export default ComposedDesktopWorkbench
