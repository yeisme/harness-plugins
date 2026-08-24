import { createElement, type ReactNode } from 'react'
import type { PaneWorkbenchController } from './controller.js'
import { registerExplorerProvider } from './explorer/provider.js'
import { registerFilePreviewProvider } from './explorer/file-preview.js'
import { registerSourceControlProvider } from './git/provider.js'
import type { PaneLocalViewProps, PaneViewRegistry } from './view-registry.js'
import { WorkspaceDesignerCoreView } from './workspace-designer-ui.js'

export const PANE_CORE_HOST_CONTRACT = 'workspace.core-pane.v1' as const
export const DSH_TOOL_DETAILS_VIEW_KIND = 'dsh.tool-details' as const
export const DSH_TOOL_DETAILS_RESOURCE_KEY = 'core:dsh.tool-details' as const
export const DSH_WORKSPACE_DESIGNER_VIEW_KIND = 'dsh.workspace-designer' as const
export const DSH_WORKSPACE_DESIGNER_RESOURCE_KEY = 'core:dsh.workspace-designer' as const

export type PaneCoreViewId = typeof DSH_TOOL_DETAILS_VIEW_KIND | typeof DSH_WORKSPACE_DESIGNER_VIEW_KIND

export function isPaneCoreViewId(id: string): id is PaneCoreViewId {
  return id === DSH_TOOL_DETAILS_VIEW_KIND || id === DSH_WORKSPACE_DESIGNER_VIEW_KIND
}

function ToolDetailsCoreView({ hostContent }: PaneLocalViewProps): ReactNode {
  return hostContent ?? createElement('section', { className: 'pwr-empty', role: 'status' },
    createElement('p', null, 'Tool details are unavailable in this DSH host.'),
  )
}

/** Registers DSH-owned surfaces as local-only providers in the canonical Pane registry. */
export function registerPaneWorkbenchCoreViews(registry: PaneViewRegistry): () => void {
  const disposeToolDetails = registry.registerView({
    descriptor: {
      kind: DSH_TOOL_DETAILS_VIEW_KIND,
      label: 'Tool Details',
      componentKey: 'dsh-tool-details',
      role: 'inspector',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: true,
    },
    component: ToolDetailsCoreView,
    showInPicker: false,
  })
  const disposeDesigner = registry.registerView({
    descriptor: {
      kind: DSH_WORKSPACE_DESIGNER_VIEW_KIND,
      label: 'Workspace Designer',
      componentKey: 'dsh-workspace-designer',
      role: 'inspector',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: true,
    },
    component: WorkspaceDesignerCoreView,
    showInPicker: false,
    i18n: { namespace: 'paneWorkbench', labelKey: 'designer.title' },
  })
  const disposeExplorer = registerExplorerProvider(registry)
  const disposeFiles = registerFilePreviewProvider(registry)
  const disposeSourceControl = registerSourceControlProvider(registry)
  return () => {
    disposeSourceControl()
    disposeFiles()
    disposeExplorer()
    disposeDesigner()
    disposeToolDetails()
  }
}

export function openPaneWorkbenchCoreView(controller: PaneWorkbenchController, id: PaneCoreViewId): void {
  switch (id) {
    case DSH_TOOL_DETAILS_VIEW_KIND:
      controller.openView({
        kind: DSH_TOOL_DETAILS_VIEW_KIND,
        resourceKey: DSH_TOOL_DETAILS_RESOURCE_KEY,
        role: 'inspector',
        preferredRegion: 'right',
        retention: 'recreate',
        singleton: true,
        preview: true,
        pinned: false,
        title: 'Tool Details',
      })
      return
    case DSH_WORKSPACE_DESIGNER_VIEW_KIND:
      controller.openView({
        kind: DSH_WORKSPACE_DESIGNER_VIEW_KIND,
        resourceKey: DSH_WORKSPACE_DESIGNER_RESOURCE_KEY,
        role: 'inspector',
        preferredRegion: 'right',
        retention: 'recreate',
        singleton: true,
        preview: false,
        pinned: true,
        title: 'Workspace Designer',
      })
      const opened = Object.values(controller.getSnapshot().views).find(view => view.kind === DSH_WORKSPACE_DESIGNER_VIEW_KIND)
      if (opened !== undefined) controller.dispatch({ type: 'maximize_group', groupId: opened.groupId })
  }
}

export function closePaneWorkbenchCoreView(controller: PaneWorkbenchController, id: PaneCoreViewId): void {
  for (const view of Object.values(controller.getSnapshot().views)) {
    if (view.kind === id) controller.dispatch({ type: 'close_view', viewId: view.id })
  }
}
