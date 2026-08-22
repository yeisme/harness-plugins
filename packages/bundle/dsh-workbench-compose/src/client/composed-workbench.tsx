/**
 * Composed Workbench sidebar face.
 *
 * This component composes the Rich Media and File/Document Workbench modules
 * into one Workbench Core shell. It uses the official `sidebar.footer.action`
 * slot and does not read reference-sidebar source or private APIs.
 *
 * @module @yeisme/dsh-workbench-compose/client
 */

import { useMemo, useState, type CSSProperties } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { CommandPalette, WorkbenchShell } from '@yeisme/dsh-workbench-core/client'
import type { WorkbenchTabV1 } from '@yeisme/dsh-workbench-core'
import { RichMediaCard } from '@yeisme/dsh-rich-media/client'
import { FileDocumentPanel, useFileTree } from '@yeisme/dsh-file-document'
import type { FileTreeHostAdapter } from '@yeisme/dsh-file-document'
import { TerminalPanel, type TerminalPanelState } from '@yeisme/dsh-terminal'
import { createComposedWorkbenchRegistry } from '../composed-registry.ts'
import { emptyHostProjection } from '../host-projection.ts'
import type { WorkbenchHostProjection } from '../host-projection.ts'
import type { ComposeKey } from './locales.ts'
import { NS, en, zh } from './locales.ts'

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

const styles: Record<'layer' | 'panel' | 'header' | 'commandButton' | 'body' | 'grid' | 'trigger' | 'placeholder' | 'placeholderTitle' | 'placeholderBody', CSSProperties> = {
  layer: { position: 'relative', display: 'grid', gap: 6, width: '100%', padding: 4 },
  panel: { display: 'grid', gap: 8, padding: 10, borderRadius: 8, border: '1px solid var(--dsh-color-border, #3d4550)', background: 'var(--dsh-color-layer, #18202b)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontWeight: 600 },
  commandButton: { minHeight: 24, padding: '0 8px', borderRadius: 6, border: '1px solid var(--dsh-color-border, #3d4550)', background: 'transparent', color: 'inherit', cursor: 'pointer' },
  body: { display: 'grid', gap: 8, minHeight: 80, fontSize: 12 },
  grid: { display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' },
  trigger: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minHeight: 32 },
  placeholder: { display: 'grid', gap: 4, padding: 12, borderRadius: 8, border: '1px dashed var(--dsh-color-border, #3d4550)' },
  placeholderTitle: { fontWeight: 600 },
  placeholderBody: { opacity: 0.72 },
}

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
        <div style={styles.grid}>
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
        />
      )
    }
    if (tab.id === TERMINAL_TAB_ID) {
      return <TerminalPanel state={terminalState} status={terminalStatus} />
    }
    return (
      <div style={styles.placeholder}>
        <span style={styles.placeholderTitle}>{t('placeholderTitle')}</span>
        <span style={styles.placeholderBody}>{t('placeholderBody')}</span>
      </div>
    )
  }

  return (
    <div style={styles.layer} data-dsh-workbench-compose>
      {open && (
        <section style={styles.panel} aria-label={t('aria')}>
          <header style={styles.header}>
            <span>{t('aria')}</span>
            <button type="button" style={styles.commandButton} onClick={() => { setCommandOpen(value => !value) }}>
              {t('commands')}
            </button>
          </header>
          <div style={styles.body}>
            <WorkbenchShell
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              renderTab={renderTab}
              status={`${tabs.length} tabs · ${commands.length} commands`}
            />
          </div>
        </section>
      )}
      {commandOpen && (
        <CommandPalette
          commands={commands}
          onRunCommand={runCommand}
          onClose={() => { setCommandOpen(false) }}
        />
      )}
      <button
        type="button"
        style={styles.trigger}
        data-active={open || undefined}
        aria-label={t('aria')}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <span>{t('trigger')}</span>
        {wide && <span aria-hidden="true">▦</span>}
      </button>
    </div>
  )
}

export { NS, en, zh }
export type { ComposeKey }
export default ComposedWorkbench
