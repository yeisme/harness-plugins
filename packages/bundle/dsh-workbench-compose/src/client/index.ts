/**
 * Composed Workbench browser entry.
 *
 * Registers contextual Pane view providers and additive open actions. The
 * legacy composed sidebar component remains exported for stories only.
 *
 * @module @yeisme/dsh-workbench-compose/client
 */

import { createElement, useEffect, type ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
export { ComposedWorkbench } from './composed-workbench.tsx'
export type { ComposedWorkbenchExtraProps, ComposedWorkbenchProps } from './composed-workbench.tsx'
export { NS, en, zh } from './composed-workbench.tsx'
export type { ComposeKey } from './composed-workbench.tsx'

export const name = 'dsh-workbench-compose'
export const inject = ['slots', 'workspaces'] as const

interface PaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
}

function installPaneFileTree(ctx: ClientContext): () => void {
  let pane: PaneWorkbenchFace | undefined
  try {
    pane = ctx.get('paneWorkbench') as PaneWorkbenchFace | undefined
  } catch {
    pane = undefined
  }
  if (pane === undefined || typeof pane.registerView !== 'function') return () => {}
  const disposers: Array<() => void> = []
  const LegacyFileTreeShim = (): ReactNode => {
    useEffect(() => { pane?.openView({ kind: 'dsh.explorer', resourceKey: 'navigator:dsh.explorer', role: 'navigator', preferredRegion: 'right', retention: 'keep-alive', singleton: true, pinned: true, title: 'Explorer' }) }, [])
    return createElement('p', { role: 'status', 'data-explorer-legacy-shim': 'file.tree' }, 'File Tree moved to dsh.explorer.')
  }
  disposers.push(pane.registerView({
    descriptor: {
      kind: 'file.tree',
      label: 'File Tree (compatibility alias)',
      componentKey: 'file-tree-alias',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: true,
      deprecated: true,
    },
    component: LegacyFileTreeShim,
    showInPicker: false,
  }))

  const openPane = (): void => {
    pane.openView({
      kind: 'dsh.explorer',
      resourceKey: 'navigator:dsh.explorer',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
      pinned: true,
      title: 'Explorer',
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
  }, () => createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: openPane }, 'File Tree'))))

  return () => {
    for (const dispose of disposers.reverse()) dispose()
  }
}

/** Mount the client face and return an exact disposer. */
export async function apply(ctx: ClientContext): Promise<() => void> {
  return installPaneFileTree(ctx)
}
