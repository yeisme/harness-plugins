/**
 * Composed Workbench sidebar face.
 *
 * This component composes the Rich Media and File/Document Workbench modules
 * into one Workbench Core shell. It uses the official `sidebar.footer.action`
 * slot and does not read reference-sidebar source or private APIs.
 *
 * @module @yeisme/dsh-workbench-compose/client
 */

import { useMemo, useState } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar } from '@yeisme/dsh-client-ui-surface'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { CommandPalette, WorkbenchShell } from '@yeisme/dsh-workbench-core/client'
import type { WorkbenchTabV1 } from '@yeisme/dsh-workbench-core'
import { RichMediaCard, PreviewTableRenderer, createPreviewAccessHandle, delimiterOfMediaType, fileEntryToPreviewResource, parseDelimitedTable } from '@yeisme/dsh-rich-media/client'
import { FileDocumentPanel, useFileTree } from '@yeisme/dsh-file-document'
import type { FileEntryV1, FileTreeHostAdapter } from '@yeisme/dsh-file-document'
import { renderMarkdown } from '@yeisme/dsh-client-ui-desktop-workbench/client'
import { TerminalPanel, type TerminalPanelState } from '@yeisme/dsh-terminal'
import { createComposedWorkbenchRegistry } from '../composed-registry.ts'
import { emptyHostProjection } from '../host-projection.ts'
import type { WorkbenchHostProjection } from '../host-projection.ts'
import type { ComposeKey } from './locales.ts'
import { NS, en, zh } from './locales.ts'

/** V3 4.6: table mode routes through the preview-platform renderer. */
function renderComposedTable(entry: FileEntryV1, text: string): React.ReactNode {
  const parsed = parseDelimitedTable(text, delimiterOfMediaType(entry.mediaType))
  const columns = (parsed.rows[0] ?? []).map((label, index) => ({ id: `col-${index}`, label }))
  const rows = parsed.rows.slice(1)
  const resource = fileEntryToPreviewResource(entry)
  const access = createPreviewAccessHandle({ resource, capabilities: ['preview'], table: rows, columns })
  return <PreviewTableRenderer resource={resource} access={access} />
}

export type ComposedWorkbenchProps =
  PropsRuntime<'sidebar.footer.action'> & PropsLocale<'workbenchCompose'>

export interface ComposedWorkbenchExtraProps {
  /** Optional Host projection; absent uses the empty projection. */
  hostProjection?: WorkbenchHostProjection | undefined
  /** Optional command runner; absent closes the palette after selection. */
  onRunCommand?: ((commandId: string) => void) | undefined
  /** Optional safe terminal state projection for the demo/sidebar. */
  terminalState?: TerminalPanelState | undefined
  /** Optional short terminal status text. */
  terminalStatus?: string | undefined
  /** Optional on-demand file tree Host adapter. */
  fileTreeAdapter?: FileTreeHostAdapter | undefined
  /** Optional root path override; defaults to the current workspace path. */
  fileTreeRootPath?: string | undefined
}

const MEDIA_TAB_ID = 'media'
const FILE_TAB_IDS = new Set(['files', 'documents'])
const TERMINAL_TAB_ID = 'terminal'

const styles = `
[data-dsh-workbench-compose]{position:relative;display:grid;gap:6px;width:100%;padding:4px}
[data-dsh-workbench-compose] .dwc-panel{min-height:80px;border:1px solid var(--vk-border-l2);border-radius:8px}
[data-dsh-workbench-compose] .dwc-grid{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
[data-dsh-workbench-compose] .dwc-placeholder{display:grid;gap:4px;padding:12px;border:1px dashed var(--vk-border-l2);border-radius:8px}
[data-dsh-workbench-compose] .dwc-placeholder strong{font-weight:600}[data-dsh-workbench-compose] .dwc-placeholder span{color:var(--vk-text-tertiary)}
[data-dsh-workbench-compose] .dwc-trigger{width:100%}
`

export function ComposedWorkbench({ wide, t, hostProjection = emptyHostProjection, onRunCommand, terminalState, terminalStatus, fileTreeAdapter, fileTreeRootPath, useSessions, useWorkspaces }: ComposedWorkbenchProps & ComposedWorkbenchExtraProps) {
  const [open, setOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [activeTabId, setActiveTabId] = useState(MEDIA_TAB_ID)
  const registry = useMemo(createComposedWorkbenchRegistry, [])
  const tabs = registry.snapshot().tabs
  const commands = registry.snapshot().commands
  const media = hostProjection.listMedia()
  const sessions = useSessions(snapshot => snapshot)
  const workspaces = useWorkspaces(snapshot => snapshot)
  const currentWorkspace = sessions.current === undefined
    ? undefined
    : workspaces.items.find(workspace => workspace.sessionIds.includes(sessions.current as never))
  const effectiveRootPath = fileTreeRootPath ?? currentWorkspace?.path
  const fileTreeEnabled = open && FILE_TAB_IDS.has(activeTabId)
  const fileTree = useFileTree(fileTreeAdapter, effectiveRootPath, fileTreeEnabled)
  const fileEntries = fileTree.status === 'ready' ? fileTree.entries : hostProjection.listFileEntries()

  const runCommand = (commandId: string): void => {
    onRunCommand?.(commandId)
    setCommandOpen(false)
  }

  const renderTab = (tab: WorkbenchTabV1) => {
    if (tab.id === MEDIA_TAB_ID) {
      if (media.length === 0) return <p>{t('empty')}</p>
      return (
        <div className="dwc-grid">
          {media.map(item => (
            <RichMediaCard
              key={`${item.owner}:${item.ref}`}
              media={item}
              src={undefined}
              resolveUrl={mediaItem => hostProjection.resolveMediaUrl(mediaItem) ?? Promise.reject(new Error('media resolver unavailable'))}
            />
          ))}
        </div>
      )
    }
    if (FILE_TAB_IDS.has(tab.id)) {
      return (
        <FileDocumentPanel
          tabId={tab.id as 'files' | 'documents'}
          entries={fileEntries}
          resolvePreviewUrl={hostProjection.resolveFilePreviewUrl}
          loadChildren={fileTree.status === 'ready' ? fileTree.loadChildren : undefined}
          loading={fileTree.status === 'loading'}
          error={fileTree.status === 'error' ? fileTree.error : undefined}
          onRetry={fileTree.retry}
          renderTable={renderComposedTable}
          renderMarkdown={(text: string) => renderMarkdown(text)}
        />
      )
    }
    if (tab.id === TERMINAL_TAB_ID) {
      return <TerminalPanel state={terminalState} status={terminalStatus} />
    }
    return (
      <div className="dwc-placeholder">
        <strong>{t('placeholderTitle')}</strong>
        <span>{t('placeholderBody')}</span>
      </div>
    )
  }

  return (
    <Surface kind="micro" data-dsh-workbench-compose>
      <style>{styles}</style>
      {open && (
        <Surface kind="workspace" className="dwc-panel" aria-label={t('aria')}>
          <SurfaceContextBar title={t('aria')} actions={<Button type="button" size="sm" variant="toolbar" onClick={() => { setCommandOpen(value => !value) }}>{t('commands')}</Button>} />
          <div className="ys-body">
            <WorkbenchShell
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              renderTab={renderTab}
              status={`${tabs.length} tabs · ${commands.length} commands`}
            />
          </div>
        </Surface>
      )}
      {commandOpen && (
        <CommandPalette
          commands={commands}
          onRunCommand={runCommand}
          onClose={() => { setCommandOpen(false) }}
        />
      )}
      <Button
        type="button"
        size="sm"
        variant={open ? 'primary' : 'toolbar'}
        className="dwc-trigger"
        data-active={open || undefined}
        aria-label={t('aria')}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <span>{t('trigger')}</span>
        {wide && <span aria-hidden="true">▦</span>}
      </Button>
    </Surface>
  )
}

export { NS, en, zh }
export type { ComposeKey }
export default ComposedWorkbench
