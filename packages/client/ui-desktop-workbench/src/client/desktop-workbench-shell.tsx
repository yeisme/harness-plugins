/**
 * Desktop Workbench React shell.
 *
 * This shell renders a session sidebar and a generic Workbench Core tab shell.
 * Domain state stays with DSH/owner services.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { useState, type ReactNode } from 'react'
import { WorkbenchShell } from '@yeisme/dsh-workbench-core/client'
import type { WorkbenchTabV1 } from '@yeisme/dsh-workbench-core'
import type { SessionManagerHostV1, SessionSummaryV1 } from '@yeisme/dsh-session-manager'
import { desktopWorkbenchStyles } from './desktop-workbench-styles.ts'
import { SessionSidebar, type SessionLineageBadge } from './session-sidebar.tsx'

export interface DesktopWorkbenchShellProps {
  /** Tabs to show in the Workbench Core shell. */
  tabs: readonly WorkbenchTabV1[]
  /** Render the active tab content. */
  renderTab: (tab: WorkbenchTabV1) => ReactNode
  /** Optional session manager host adapter. */
  sessionHost?: SessionManagerHostV1 | undefined
  /** Optional callback when a session is opened. */
  onOpenSession?: ((sessionId: string) => void) | undefined
  /** Optional rewrite/fork lineage badge for session rows. */
  lineageOf?: ((session: SessionSummaryV1) => SessionLineageBadge) | undefined
  /** Optional status line. */
  status?: string | undefined
  /** Close the overlay and return to the underlying DSH conversation UI. */
  onClose?: (() => void) | undefined
}

function initialSidebarVisibility(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(min-width: 821px)').matches
}

export function DesktopWorkbenchShell({ tabs, renderTab, sessionHost, onOpenSession, lineageOf, status, onClose }: DesktopWorkbenchShellProps) {
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id ?? '')
  const [sidebarVisible, setSidebarVisible] = useState(initialSidebarVisibility)
  return (
    <div data-dsh-desktop-workbench data-sidebar-visible={String(sidebarVisible)}>
      <style data-dsh-desktop-workbench-styles>{desktopWorkbenchStyles}</style>
      <div data-dsh-desktop-shell-sidebar>
        <SessionSidebar host={sessionHost ?? fallbackHost} onOpenSession={onOpenSession} lineageOf={lineageOf} />
      </div>
      <main data-dsh-desktop-main>
        <header data-dsh-desktop-toolbar>
          <div data-dsh-desktop-toolbar-group>
            <button
              type="button"
              data-dsh-desktop-toolbar-button="sidebar"
              aria-label={sidebarVisible ? '隐藏会话侧栏' : '显示会话侧栏'}
              aria-expanded={sidebarVisible}
              onClick={() => { setSidebarVisible(value => !value) }}
            >
              <span aria-hidden="true">{sidebarVisible ? '◧' : '▤'}</span>
              <span data-label>{sidebarVisible ? '隐藏会话' : '显示会话'}</span>
            </button>
            <div data-dsh-desktop-product>
              <small>DSH WORKBENCH</small>
              <strong>桌面工作台</strong>
            </div>
          </div>
          <div data-dsh-desktop-toolbar-actions>
            <span data-dsh-desktop-status>{status ?? `${tabs.length} 个工作区视图`}</span>
            {onClose !== undefined && (
              <button
                type="button"
                data-dsh-desktop-toolbar-button="close"
                aria-label="返回 DSH 会话"
                onClick={onClose}
              >
                <span aria-hidden="true">×</span>
                <span data-label>返回会话</span>
              </button>
            )}
          </div>
        </header>
        <div data-dsh-desktop-content>
          <WorkbenchShell
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            renderTab={renderTab}
            status={status}
          />
        </div>
      </main>
    </div>
  )
}

const fallbackHost = {
  version: '0.1.0-rc.1',
  capability: 'session-manager',
  async listSessions() {
    return []
  },
  async archiveSession(sessionId: string) { return { status: 'not_implemented' as const, sessionId } },
  async restoreSession(sessionId: string) { return { status: 'not_implemented' as const, sessionId } },
  async trashSession(sessionId: string) { return { status: 'not_implemented' as const, sessionId } },
  async purgeSession(sessionId: string) { return { status: 'not_implemented' as const, sessionId } },
  async setLabels(sessionId: string) { return { status: 'not_implemented' as const, sessionId } },
  async pauseSession(sessionId: string) { return { status: 'not_implemented' as const, sessionId } },
  async resumeSession(sessionId: string) { return { status: 'not_implemented' as const, sessionId } },
  async forkSession(sessionId: string) { return { status: 'not_implemented' as const, sessionId } },
} satisfies SessionManagerHostV1

export default DesktopWorkbenchShell
