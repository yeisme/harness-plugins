/**
 * File Pane for the Desktop Workbench.
 *
 * This component adapts the `FileHostV1` contract to the existing
 * `FileTreeHostAdapter` + `FileDocumentPanel` stack. It keeps filesystem
 * paths out of the browser and only consumes safe `FileEntryV1` projections.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

import { useCallback, useMemo } from 'react'
import { FileDocumentPanel, useFileTree, type FileEntryV1, type FileTreeHostAdapter } from '@yeisme/dsh-file-document'
import { probeFileWatch, type FileHostV1 } from '@yeisme/dsh-file-host'

export interface FilePaneProps {
  /** File host adapter. */
  host: FileHostV1
  /** Tab id passed to FileDocumentPanel: files or documents. */
  tabId?: 'files' | 'documents' | undefined
  /** Optional Host-authorized preview URL resolver. */
  resolvePreviewUrl?: ((entry: FileEntryV1) => string | undefined) | undefined
  /** Optional callback when a file is opened as a preview tab. */
  onOpenEntry?: ((entry: FileEntryV1) => void) | undefined
  /** Optional callback when a file is pinned as a durable tab. */
  onPinEntry?: ((entry: FileEntryV1) => void) | undefined
  /** Whether the file tree should load; defaults to true. */
  enabled?: boolean | undefined
  /** Optional opaque root parent ref; absent loads host roots. */
  rootParentRef?: string | undefined
  /** When false, the explorer stays a tree and does not embed a preview pane. */
  showPreviewPanel?: boolean | undefined
  /** Compact navigator chrome for the right-side directory tree. */
  compact?: boolean | undefined
}

/** Adapt a `FileHostV1` to the on-demand `FileTreeHostAdapter` shape. */
function createFileTreeAdapter(host: FileHostV1, rootParentRef: string | undefined): FileTreeHostAdapter {
  return {
    async listEntries(request) {
      const parentRef = request?.parentId ?? rootParentRef
      return host.listEntries(parentRef)
    },
    resolvePath(entryId) {
      // The host contract uses opaque refs, so the entry id is already a safe ref.
      return entryId
    },
  }
}

export function FilePane({ host, tabId = 'files', resolvePreviewUrl, onOpenEntry, onPinEntry, enabled = true, rootParentRef, showPreviewPanel = true, compact = false }: FilePaneProps) {
  const adapter = useMemo(() => createFileTreeAdapter(host, rootParentRef), [host, rootParentRef])
  const fileTree = useFileTree(adapter, rootParentRef, enabled)
  const watch = probeFileWatch(host)
  const loadText = useCallback(async (entry: FileEntryV1) => {
    if (host.readText === undefined) return undefined
    const result = await host.readText(entry)
    if (result === undefined || result.binary) return undefined
    return result.content
  }, [host])
  return (
    <section data-dsh-file-pane data-file-watch={watch.live ? 'live' : 'ondemand'} data-freshness={watch.freshness}>
      {compact ? null : <p role="status" data-dsh-file-watch-reason>{watch.reason}</p>}
      <FileDocumentPanel
        tabId={tabId}
        entries={fileTree.entries}
        resolvePreviewUrl={resolvePreviewUrl ?? host.resolvePreviewUrl}
        onOpenEntry={onOpenEntry}
        onPinEntry={onPinEntry}
        loadText={host.readText === undefined || showPreviewPanel === false ? undefined : loadText}
        showPreviewPanel={showPreviewPanel}
        compact={compact}
        loadChildren={fileTree.status === 'ready' ? fileTree.loadChildren : undefined}
        loading={fileTree.status === 'loading'}
        error={fileTree.status === 'error' ? fileTree.error : undefined}
        onRetry={fileTree.retry}
      />
    </section>
  )
}

export default FilePane
