/**
 * DSH Workbench Core React shell.
 *
 * This is the generic tab shell that feature modules render into. It owns
 * only layout, tablist semantics, active-tab selection, close actions, and
 * reorder gestures; domain state and business actions stay in each
 * module/owner.
 *
 * @module @yeisme/dsh-workbench-core/client
 */

import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
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
  /** Optional reorder handler called with source then target tab id. */
  onReorderTabs?: ((sourceTabId: string, targetTabId: string) => void) | undefined
  /** Render the active tab content. */
  renderTab: (tab: WorkbenchTabV1) => ReactNode
  /** Optional status line under the main panel. */
  status?: string | undefined
}

const styles: Record<'root' | 'tabs' | 'tab' | 'active' | 'close' | 'panel' | 'status', React.CSSProperties> = {
  root: {
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    color: 'var(--dsw-alias-label-primary, #f2f2f4)',
    background: 'var(--dsw-alias-bg-base, #151517)',
  },
  tabs: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: 3,
    minWidth: 0,
    minHeight: 52,
    padding: '8px 14px 7px',
    overflowX: 'auto',
    overflowY: 'hidden',
    background: 'var(--dsw-alias-bg-layer-1, #232324)',
    borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12))',
    scrollbarWidth: 'thin',
  },
  tab: {
    display: 'inline-flex',
    flex: '0 0 auto',
    alignItems: 'center',
    gap: 7,
    minHeight: 36,
    padding: '0 11px',
    color: 'var(--dsw-alias-label-secondary, #c6c6cb)',
    background: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 8,
    cursor: 'pointer',
    userSelect: 'none',
  },
  active: {
    color: 'var(--dsw-alias-label-primary, #f2f2f4)',
    background: 'var(--dsw-alias-button-ghost-active-fill, #343438)',
    borderColor: 'var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12))',
  },
  close: {
    display: 'inline-grid',
    placeItems: 'center',
    width: 26,
    height: 26,
    padding: 0,
    color: 'var(--dsw-alias-label-tertiary, #92929b)',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
  },
  panel: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'auto',
    padding: 'clamp(14px, 2.2vw, 26px)',
    background: 'var(--dsw-alias-bg-base, #151517)',
  },
  status: {
    minHeight: 28,
    padding: '6px 14px',
    color: 'var(--dsw-alias-label-tertiary, #92929b)',
    background: 'var(--dsw-alias-bg-layer-1, #232324)',
    borderTop: '1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.06))',
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
  },
}

/** Accessible workbench shell with tablist semantics. */
export function WorkbenchShell({ tabs, activeTabId, onSelectTab, onCloseTab, onReorderTabs, renderTab, status }: WorkbenchShellProps) {
  const active = tabs.find(tab => tab.id === activeTabId) ?? tabs[0]
  const tabRefs = useRef<Array<HTMLElement | null>>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const focusTab = (index: number): void => {
    const target = tabs[index]
    if (target === undefined) return
    onSelectTab(target.id)
    tabRefs.current[index]?.focus()
  }

  const handleTablistKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (tabs.length === 0) return
    if (event.altKey) return
    const currentIndex = active === undefined ? -1 : tabs.findIndex(tab => tab.id === active.id)
    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = currentIndex < 0 ? tabs.length - 1 : (currentIndex - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return
    event.preventDefault()
    focusTab(nextIndex)
  }

  const handleTabKeyDown = (tab: WorkbenchTabV1, event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Delete' && tab.closable && onCloseTab !== undefined) {
      event.preventDefault()
      onCloseTab(tab.id)
      return
    }
    if (event.altKey && event.key === 'ArrowLeft' && onReorderTabs !== undefined) {
      event.preventDefault()
      const index = tabs.findIndex(candidate => candidate.id === tab.id)
      const target = tabs[index - 1]
      if (target !== undefined) onReorderTabs(tab.id, target.id)
      return
    }
    if (event.altKey && event.key === 'ArrowRight' && onReorderTabs !== undefined) {
      event.preventDefault()
      const index = tabs.findIndex(candidate => candidate.id === tab.id)
      const target = tabs[index + 1]
      if (target !== undefined) onReorderTabs(tab.id, target.id)
    }
  }

  const handleDragStart = (tab: WorkbenchTabV1, event: DragEvent<HTMLDivElement>): void => {
    setDraggingId(tab.id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tab.id)
  }

  const handleDrop = (targetTab: WorkbenchTabV1, event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const rawSourceId = event.dataTransfer.getData('text/plain')
    const sourceId = rawSourceId || draggingId
    setDraggingId(null)
    if (sourceId === null || sourceId === '' || sourceId === targetTab.id || onReorderTabs === undefined) return
    onReorderTabs(sourceId, targetTab.id)
  }

  return (
    <div style={styles.root} data-dsh-workbench-core>
      <div style={styles.tabs} role="tablist" aria-label="Workbench" data-dsh-workbench-tabs onKeyDown={handleTablistKeyDown}>
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            ref={element => { tabRefs.current[index] = element }}
            role="tab"
            tabIndex={tab.id === active?.id ? 0 : -1}
            aria-label={tab.title}
            aria-selected={tab.id === active?.id}
            data-dsh-workbench-tab={tab.id}
            data-active={tab.id === active?.id || undefined}
            style={tab.id === active?.id ? { ...styles.tab, ...styles.active } : styles.tab}
            draggable
            onClick={() => { onSelectTab(tab.id) }}
            onKeyDown={event => { handleTabKeyDown(tab, event) }}
            onDragStart={event => { handleDragStart(tab, event) }}
            onDragOver={event => { if (onReorderTabs !== undefined) event.preventDefault() }}
            onDrop={event => { handleDrop(tab, event) }}
            onDragEnd={() => { setDraggingId(null) }}
          >
            <span>{tab.title}</span>
            {tab.closable && onCloseTab !== undefined && (
              <button
                type="button"
                style={styles.close}
                aria-label={`Close ${tab.title}`}
                onClick={event => {
                  event.stopPropagation()
                  onCloseTab(tab.id)
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={styles.panel} role="tabpanel" data-dsh-workbench-panel>
        {active === undefined ? null : renderTab(active)}
      </div>
      {status !== undefined && <div style={styles.status} role="status" data-dsh-workbench-status>{status}</div>}
    </div>
  )
}

export default WorkbenchShell
