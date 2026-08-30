/**
 * Pane workbench registration for File/Document views (V3 4.1).
 *
 * `workspace.explorer` is a singleton navigator (the landing surface for
 * browsing); `workspace.document` is a NON-singleton content view opened per
 * document with an owner-issued opaque resource key. The legacy combined
 * "documents tab" singleton panel is therefore no longer the production open
 * path — documents open as individual dedupe-able views.
 *
 * Resource keys are derived ONLY from the owner-issued `FileEntryV1.id`
 * (already opaque); file names/titles never become keys, and no path, URL,
 * or authority is constructed here.
 *
 * @module @yeisme/dsh-file-document/client
 */
import { createElement } from 'react'
import { FileDocumentPanel, type FileDocumentPanelProps } from './file-document-panel.tsx'
import { isFileEntry, type FileEntryV1 } from '../types.ts'

export const WORKSPACE_EXPLORER_VIEW_KIND = 'workspace.explorer'
export const WORKSPACE_DOCUMENT_VIEW_KIND = 'workspace.document'

/** Minimal pane workbench face this module needs (structural probe). */
export interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
}

export interface FileDocumentPaneOptions {
  /** Panel props for the singleton explorer (owner seam supplies entries). */
  readonly explorerPanel?: Omit<FileDocumentPanelProps, 'tabId'> | undefined
  /** Panel props factory for a per-document view. */
  readonly documentPanel?: ((entry: FileEntryV1) => Omit<FileDocumentPanelProps, 'tabId' | 'entries'>) | undefined
  /** Resolves the opaque entry for a document resource key after a reopen. */
  readonly resolveEntry?: ((entryId: string) => FileEntryV1 | undefined) | undefined
}

export interface FileDocumentPaneSurface {
  readonly registered: boolean
  /** Opens (or reveals) the singleton explorer navigator. */
  readonly openExplorer: () => void
  /**
   * Opens one non-singleton document view keyed by the owner-issued opaque
   * id. Re-opening the same entry dedupes onto the existing view.
   */
  readonly openDocument: (entry: FileEntryV1) => void
  readonly dispose: () => void
}

function isEntryIdOpaque(entryId: string): boolean {
  // Opaque ids are short bounded tokens; a path/URL/authority never passes.
  return /^[A-Za-z0-9._:-]{1,128}$/.test(entryId) && !entryId.includes('..') && !entryId.includes('/')
}

export function applyFileDocumentPaneViews(
  pane: unknown,
  options: FileDocumentPaneOptions = {},
): FileDocumentPaneSurface {
  const candidate = pane as PaneWorkbenchFace | null | undefined
  const usable = candidate !== null && candidate !== undefined
    && typeof candidate.registerView === 'function' && typeof candidate.openView === 'function'
  if (!usable) return { registered: false, openExplorer: () => {}, openDocument: () => {}, dispose: () => {} }

  const workbench = candidate as PaneWorkbenchFace
  const disposers: Array<() => void> = []

  disposers.push(workbench.registerView({
    descriptor: {
      kind: WORKSPACE_EXPLORER_VIEW_KIND,
      label: 'Explorer',
      componentKey: 'workspace-explorer',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
    },
    presentation: {
      icon: 'folder',
      defaultEdge: 'right',
      defaultSize: 360,
      minWidth: 280,
    },
    component: () => createElement(FileDocumentPanel, {
      tabId: 'files',
      showPreviewPanel: false,
      ...(options.explorerPanel ?? {}),
    }),
  }))

  disposers.push(workbench.registerView({
    descriptor: {
      kind: WORKSPACE_DOCUMENT_VIEW_KIND,
      label: 'Document',
      componentKey: 'workspace-document',
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: false,
    },
    presentation: { icon: 'document', defaultEdge: 'right' },
    component: () => null,
  }))

  return {
    registered: true,
    openExplorer: () => {
      workbench.openView({
        kind: WORKSPACE_EXPLORER_VIEW_KIND,
        resourceKey: 'explorer:root',
        role: 'navigator',
        preferredRegion: 'right',
        retention: 'keep-alive',
        singleton: true,
        title: 'Explorer',
      })
    },
    openDocument: (entry: FileEntryV1) => {
      if (!isFileEntry(entry) || entry.kind === 'directory' || !isEntryIdOpaque(entry.id)) return
      workbench.openView({
        kind: WORKSPACE_DOCUMENT_VIEW_KIND,
        resourceKey: `document:${entry.id}`,
        role: 'content',
        preferredRegion: 'right',
        retention: 'snapshot',
        singleton: false,
        title: entry.name,
        projection: { entryId: entry.id },
      })
    },
    dispose: () => { for (const dispose of disposers.splice(0)) dispose() },
  }
}
