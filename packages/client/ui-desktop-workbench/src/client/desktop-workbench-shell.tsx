/**
 * Desktop Workbench React shell.
 *
 * This shell renders a session sidebar and a generic Workbench Core tab shell.
 * Domain state stays with DSH/owner services.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import { WorkbenchShell } from '@yeisme/dsh-workbench-core/client'
import type { WorkbenchTabV1 } from '@yeisme/dsh-workbench-core'
import type { SessionManagerHostV1, SessionSummaryV1 } from '@yeisme/dsh-session-manager'
import { resolveSessionManagerHost } from '@yeisme/dsh-session-manager'
import { desktopWorkbenchStyles } from './desktop-workbench-styles.ts'
import { SessionSidebar, type SessionLineageBadge } from './session-sidebar.tsx'

export interface DesktopWorkbenchShellProps {
  /** Tabs to show in the Workbench Core shell. */
  tabs: readonly WorkbenchTabV1[]
  /** Render the active tab content. */
  renderTab: (tab: WorkbenchTabV1) => ReactNode
  /**
   * Optional session manager host adapter. Falls back to the host- or
   * plugin-bound real service when one is live, then to the honest placeholder.
   */
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

export function DesktopWorkbenchShell({ tabs, renderTab, sessionHost, onOpenSession, lineageOf, status, onClose }: DesktopWorkbenchShellProps) {
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id ?? '')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  return (
    <Surface kind="workspace" data-dsh-desktop-workbench data-sidebar-visible={String(sidebarVisible)}>
      <style data-dsh-desktop-workbench-styles>{desktopWorkbenchStyles}</style>
      <div data-dsh-desktop-shell-sidebar>
        <SessionSidebar host={sessionHost ?? resolveSessionManagerHost()} onOpenSession={onOpenSession} lineageOf={lineageOf} />
      </div>
      <main data-dsh-desktop-main>
        <header data-dsh-desktop-toolbar>
          <div data-dsh-desktop-toolbar-group>
            <Button
              type="button"
              size="sm"
              variant="toolbar"
              aria-label={sidebarVisible ? '隐藏会话侧栏' : '显示会话侧栏'}
              aria-expanded={sidebarVisible}
              onClick={() => { setSidebarVisible(value => !value) }}
            >
              <span data-dsh-desktop-toolbar-button="sidebar"><span aria-hidden="true">{sidebarVisible ? '◧' : '▤'}</span><span data-label>{sidebarVisible ? '隐藏会话' : '显示会话'}</span></span>
            </Button>
            <div data-dsh-desktop-product>
              <small>DSH WORKBENCH</small>
              <strong>桌面工作台</strong>
            </div>
          </div>
          <div data-dsh-desktop-toolbar-actions>
            <span data-dsh-desktop-status>{status ?? `${tabs.length} 个工作区视图`}</span>
            {onClose !== undefined && (
              <Button
                type="button"
                size="sm"
                variant="toolbar"
                aria-label="返回 DSH 会话"
                onClick={onClose}
              >
                <span data-dsh-desktop-toolbar-button="close"><span aria-hidden="true">×</span><span data-label>返回会话</span></span>
              </Button>
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
    </Surface>
  )
}



export default DesktopWorkbenchShell
