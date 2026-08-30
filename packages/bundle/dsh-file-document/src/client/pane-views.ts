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
import {
  documentOpenReducer,
  EMPTY_DOCUMENT_OPEN_STATE,
  isDocumentOpenKey,
  type DocumentOpenAction,
  type DocumentOpenRequest,
  type DocumentOpenStateV1,
} from './document-open-state.ts'

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

export type DocumentOpenKind = 'preview' | 'edit' | 'pin' | 'duplicate'

export type { DocumentOpenRequest, DocumentOpenStateV1 }

export interface FileDocumentPaneSurface {
  readonly registered: boolean
  /** Opens (or reveals) the singleton explorer navigator. */
  readonly openExplorer: () => void
  /**
   * Opens one non-singleton document view keyed by the owner-issued opaque
   * id. Re-opening the same entry dedupes onto the existing view.
   */
  readonly openDocument: (entry: FileEntryV1) => void
  /**
   * V3 4.2 interaction entry: single click previews, double-click/Enter
   * edits durably, pin pins, duplicate opens an explicit second copy.
   * Dirty documents block silent replacement (blocked request returned).
   */
  readonly openEntry: (entry: FileEntryV1, kind: DocumentOpenKind) => DocumentOpenRequest | undefined
  /** Marks a document dirty/clean; dirty state blocks replacement. */
  readonly markDirty: (entryId: string, dirty: boolean) => void
  /** Session switch: transient previews drop, pinned documents survive. */
  readonly switchSession: (session: string) => void
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
  if (!usable) {
    return {
      registered: false,
      openExplorer: () => {},
      openDocument: () => {},
      openEntry: () => undefined,
      markDirty: () => {},
      switchSession: () => {},
      dispose: () => {},
    }
  }

  const workbench = candidate as PaneWorkbenchFace
  const disposers: Array<() => void> = []
  let openState: DocumentOpenStateV1 = EMPTY_DOCUMENT_OPEN_STATE

  const dispatchOpen = (action: DocumentOpenAction): DocumentOpenRequest | undefined => {
    const next = documentOpenReducer(openState, action)
    openState = next.state
    if (next.request === undefined || next.request.blocked === 'dirty') return next.request
    workbench.openView({
      kind: WORKSPACE_DOCUMENT_VIEW_KIND,
      resourceKey: next.request.resourceKey,
      role: 'content',
      preferredRegion: 'right',
      retention: next.request.retention,
      singleton: false,
      projection: 'entryId' in action ? { entryId: action.entryId } : undefined,
    })
    return next.request
  }

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
    openEntry: (entry: FileEntryV1, kind: DocumentOpenKind) => {
      if (!isDocumentOpenKey(entry)) return undefined
      return dispatchOpen({ type: kind, entryId: entry.id })
    },
    markDirty: (entryId: string, dirty: boolean) => {
      openState = documentOpenReducer(openState, { type: dirty ? 'mark_dirty' : 'clear_dirty', entryId }).state
    },
    switchSession: (session: string) => {
      openState = documentOpenReducer(openState, { type: 'session_switch', session }).state
    },
    dispose: () => { for (const dispose of disposers.splice(0)) dispose() },
  }
}
