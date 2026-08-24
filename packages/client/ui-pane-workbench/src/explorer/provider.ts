import type { PaneWorkbenchController } from '../controller.js'
import type { PaneViewRegistry } from '../view-registry.js'
import { t } from '../i18n/locale.js'
import { createFileOpenRequest } from './file-lifecycle.js'
import type { ExplorerOpenAdapterV1 } from './open-adapter.js'
import { ExplorerTreeView } from './tree-ui.js'
import type { ExplorerTreeNodeV1 } from './tree-state.js'

export const DSH_EXPLORER_VIEW_KIND = 'dsh.explorer' as const
export const DSH_EXPLORER_RESOURCE_KEY = 'navigator:dsh.explorer' as const
export const DSH_FILE_PREVIEW_VIEW_KIND = 'file.preview' as const

export type { ExplorerOpenAdapterV1 } from './open-adapter.js'

export function createExplorerOpenAdapter(controller: PaneWorkbenchController): ExplorerOpenAdapterV1 {
  return {
    openResource(node, mode) {
      if (node.kind === 'directory') return
      controller.openView(createFileOpenRequest(node.ref, node.name, mode, node.version))
    },
    openDiff(node) {
      controller.openView({
        kind: 'git.diff',
        resourceKey: `diff:${node.ref}`,
        role: 'content',
        preferredRegion: 'right',
        retention: 'recreate',
        singleton: false,
        preview: true,
        title: node.name,
        resourceVersion: node.version,
      })
    },
  }
}

export function registerExplorerProvider(registry: PaneViewRegistry): () => void {
  if (registry.has(DSH_EXPLORER_VIEW_KIND)) return () => {}
  return registry.registerView({
    descriptor: {
      kind: DSH_EXPLORER_VIEW_KIND,
      label: 'Explorer',
      componentKey: 'dsh-explorer',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
    },
    component: ExplorerTreeView,
    showInPicker: true,
    i18n: { namespace: 'paneWorkbench', labelKey: 'rail.explorer' },
  })
}

export function openExplorerNavigator(controller: PaneWorkbenchController): void {
  controller.openView({
    kind: DSH_EXPLORER_VIEW_KIND,
    resourceKey: DSH_EXPLORER_RESOURCE_KEY,
    role: 'navigator',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    preview: false,
    pinned: true,
    title: t('rail.explorer'),
  })
}

export function explorerOpenFromEntry(
  controller: PaneWorkbenchController,
  source: 'rail' | 'picker' | 'sidebar' | 'terminal' | 'file-link',
  node: ExplorerTreeNodeV1,
  mode: 'preview' | 'pin' = 'preview',
): void {
  void source
  openExplorerNavigator(controller)
  createExplorerOpenAdapter(controller).openResource(node, mode)
}
