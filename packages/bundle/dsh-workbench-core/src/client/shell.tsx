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
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface } from '@yeisme/dsh-client-ui-surface'
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

const styles = `
[data-dsh-workbench-core]{display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:100%;height:100%;min-height:0}
[data-dsh-workbench-tabs]{display:flex;flex-wrap:nowrap;gap:3px;min-width:0;min-height:52px;padding:8px 14px 7px;overflow-x:auto;overflow-y:hidden;background:var(--vk-bg-layer-1);border-bottom:1px solid var(--vk-border-l2);scrollbar-width:thin}
[data-dsh-workbench-tab]{display:inline-flex;flex:0 0 auto;align-items:center;gap:7px;min-height:36px;padding:0 11px;color:var(--vk-text-secondary);background:transparent;border:1px solid transparent;border-radius:8px;cursor:pointer;user-select:none}
[data-dsh-workbench-tab][data-active]{color:var(--vk-text-primary);background:var(--vk-fill-active);border-color:var(--vk-border-l2)}
[data-dsh-workbench-panel]{min-width:0;min-height:0;overflow:auto;padding:clamp(14px,2.2cqi,26px);background:var(--vk-bg-base)}
[data-dsh-workbench-status]{min-height:28px;padding:6px 14px;color:var(--vk-text-tertiary);background:var(--vk-bg-layer-1);border-top:1px solid var(--vk-border-l1);font-size:11px;font-variant-numeric:tabular-nums}
`

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
    <Surface kind="workspace" data-dsh-workbench-core>
      <style>{styles}</style>
      <div role="tablist" aria-label="Workbench" data-dsh-workbench-tabs onKeyDown={handleTablistKeyDown}>
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
              <Button
                type="button"
                size="sm"
                variant="toolbar"
                aria-label={`Close ${tab.title}`}
                onClick={event => {
                  event.stopPropagation()
                  onCloseTab(tab.id)
                }}
              >
                ×
              </Button>
            )}
          </div>
        ))}
      </div>
      <div role="tabpanel" data-dsh-workbench-panel>
        {active === undefined ? null : renderTab(active)}
      </div>
      {status !== undefined && <div role="status" data-dsh-workbench-status>{status}</div>}
    </Surface>
  )
}

export default WorkbenchShell
