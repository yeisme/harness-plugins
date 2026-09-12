import type { PaneWorkbenchController } from '../controller.js'
import type { ExplorerRuntimeSourceV1 } from './runtime.js'
import { openExplorerNavigator, DSH_EXPLORER_VIEW_KIND, DSH_EXPLORER_RESOURCE_KEY } from './provider.js'

export async function requestExplorerReveal(controller: PaneWorkbenchController, source: ExplorerRuntimeSourceV1, ref: string, version: string, signal?: AbortSignal, pendingSignal?: AbortSignal): Promise<boolean> {
  const runtime = source.getSnapshot()
  if (!runtime?.revealResource || !source.reveal || !source.reveal.canNavigate()) return false
  openExplorerNavigator(controller)
  const isActive = () => {
    const snapshot = controller.getSnapshot()
    const view = Object.values(snapshot.views).find(view => view.kind === DSH_EXPLORER_VIEW_KIND && view.resourceKey === DSH_EXPLORER_RESOURCE_KEY)
    return view !== undefined && snapshot.activeGroupId === view.groupId && snapshot.groups[view.groupId]?.activeTabId === view.id
  }
  return source.reveal.request({ ref, version, runtime, isActive }, signal, pendingSignal)
}
