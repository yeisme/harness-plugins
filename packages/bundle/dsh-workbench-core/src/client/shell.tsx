/**
 * DSH Workbench Core React shell.
 *
 * This is the generic tab shell that feature modules render into. It owns
 * only layout, tablist semantics, and active-tab selection; domain state and
 * business actions stay in each module/owner.
 *
 * @module @yeisme/dsh-workbench-core/client
 */

import type { ReactNode } from 'react'
import type { WorkbenchTabV1 } from '../types.ts'

export interface WorkbenchShellProps {
  /** Sorted tabs from the Workbench Registry. */
  tabs: readonly WorkbenchTabV1[]
  /** Active tab id. */
  activeTabId: string
  /** Select a tab. */
  onSelectTab: (tabId: string) => void
  /** Optional close handler; only called for closable tabs. */
  onCloseTab?: ((tabId: string) => void) | undefined
  /** Render the active tab content. */
  renderTab: (tab: WorkbenchTabV1) => ReactNode
  /** Optional status line under the main panel. */
  status?: string | undefined
}

const styles: Record<'root' | 'tabs' | 'tab' | 'active' | 'panel' | 'status', React.CSSProperties> = {
  root: { display: 'grid', gridTemplateRows: 'auto 1fr auto', height: '100%', minHeight: 0 },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, borderBottom: '1px solid var(--dsh-color-border, #3d4550)' },
  tab: { minHeight: 28, padding: '0 10px', border: '1px solid transparent', borderRadius: 6, background: 'transparent', color: 'inherit', cursor: 'pointer' },
  active: { borderColor: 'var(--dsh-color-border, #3d4550)', background: 'var(--dsh-color-layer-2, #202b38)' },
  panel: { minHeight: 0, overflow: 'auto', padding: 8 },
  status: { padding: '4px 8px', fontSize: 11, opacity: 0.72, borderTop: '1px solid var(--dsh-color-border, #3d4550)' },
}

/** Accessible workbench shell with tablist semantics. */
export function WorkbenchShell({ tabs, activeTabId, onSelectTab, onCloseTab, renderTab, status }: WorkbenchShellProps) {
  const active = tabs.find(tab => tab.id === activeTabId) ?? tabs[0]

  return (
    <div style={styles.root} data-dsh-workbench-core>
      <div style={styles.tabs} role="tablist" aria-label="Workbench">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active?.id}
            style={tab.id === active?.id ? { ...styles.tab, ...styles.active } : styles.tab}
            onClick={() => { onSelectTab(tab.id) }}
            onKeyDown={(event) => {
              if (event.key === 'Delete' && tab.closable && onCloseTab !== undefined) {
                event.preventDefault()
                onCloseTab(tab.id)
              }
            }}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div style={styles.panel} role="tabpanel">
        {active === undefined ? null : renderTab(active)}
      </div>
      {status !== undefined && <div style={styles.status} role="status">{status}</div>}
    </div>
  )
}

export default WorkbenchShell
