/**
 * Composed Workbench browser entry.
 *
 * Registers contextual Pane view providers and additive open actions. The
 * legacy composed sidebar component remains exported for stories only.
 *
 * @module @yeisme/dsh-workbench-compose/client
 */

import { createElement, type ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import {
  createFileTreeHostAdapter,
  FileDocumentPanel,
  useFileTree,
  type FileTreeHostAdapter,
} from '@yeisme/dsh-file-document'
export { ComposedWorkbench } from './composed-workbench.tsx'
export type { ComposedWorkbenchExtraProps, ComposedWorkbenchProps } from './composed-workbench.tsx'
export { NS, en, zh } from './composed-workbench.tsx'
export type { ComposeKey } from './composed-workbench.tsx'

export const name = 'dsh-workbench-compose'
export const inject = ['slots', 'workspaces', 'paneWorkbench'] as const

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
}

interface DirectoryListingLike {
  readonly path: string
  readonly entries: readonly { readonly name: string; readonly path: string; readonly hidden?: boolean }[]
}

function FileTreePaneView({ adapter }: { readonly adapter?: FileTreeHostAdapter }): ReactNode {
  const fileTree = useFileTree(adapter, undefined, true)
  const loadChildren = fileTree.status === 'ready' ? fileTree.loadChildren : undefined
  const entries = fileTree.status === 'ready' ? fileTree.entries : []
  const retry = fileTree.retry
  return createElement('div', { 'data-dsh-file-tree-pane': true },
    fileTree.status === 'loading'
      ? createElement('p', null, 'Loading file tree…')
      : fileTree.status === 'error'
        ? createElement('div', null,
          createElement('p', null, `Failed to load file tree: ${fileTree.error ?? 'unknown error'}`),
          createElement('button', { type: 'button', onClick: retry }, 'Retry'),
        )
        : createElement(FileDocumentPanel, {
          tabId: 'files',
          entries,
          loadChildren,
          onOpenEntry: () => undefined,
        }),
  )
}

function installPaneFileTree(ctx: ClientContext): () => void {
  const pane = ctx.get('paneWorkbench') as PaneWorkbenchFace | undefined
  if (pane === undefined) throw new Error('dsh-workbench-compose requires Pane Workbench V2; the deprecated sidebar workbench is not a production fallback')
  const workspaces = ctx.get('workspaces') as {
    listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListingLike>
  } | undefined
  const fileTreeAdapter = workspaces === undefined
    ? undefined
    : createFileTreeHostAdapter((path, signal) => workspaces.listDirectory(path, signal))

  const disposers: Array<() => void> = []
  disposers.push(pane.registerView({
    descriptor: {
      kind: 'file.tree',
      label: 'File Tree',
      componentKey: 'file-tree',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: true,
    },
    component: () => fileTreeAdapter === undefined ? createElement(FileTreePaneView) : createElement(FileTreePaneView, { adapter: fileTreeAdapter }),
  }))

  const openPane = (): void => {
    pane.openView({
      kind: 'file.tree',
      resourceKey: 'file-tree:root',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: true,
      pinned: true,
      title: 'File Tree',
    })
  }

  const slots = ctx.get('slots') as {
    inject(name: string, register: () => () => void): () => void
    register(input: unknown, component: () => ReactNode): () => void
  }
  disposers.push(slots.inject('conversation.session.header.actions', () => slots.register({
    name: 'conversation.session.header.actions',
    id: 'dsh-file-tree-open',
    order: 20,
    inject: (): { readonly openPane: () => void } => ({ openPane }),
  }, () => createElement('button', { type: 'button', onClick: openPane }, 'File Tree'))))

  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext): Promise<() => void> {
  return installPaneFileTree(ctx)
}
