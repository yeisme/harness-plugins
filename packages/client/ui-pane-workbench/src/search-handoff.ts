import type { PaneWorkbenchController } from './controller.js'
import { DSH_WORKSPACE_SEARCH_RESOURCE_KEY, DSH_WORKSPACE_SEARCH_VIEW_KIND } from './core-pane.js'
import type { SearchCenterCategory, SearchCenterQuickView } from './search-catalog.js'
import type { SearchCenterControls } from './search-controls.js'
import type { WorkspaceSearchFiltersV1 } from './search-group.js'
import type { PaneViewRegistry } from './view-registry.js'
import { openWorkspaceSearchPane } from './search-open.js'

export interface SearchCenterHandoff {
  readonly query: string
  readonly category: SearchCenterCategory
  readonly quickView?: SearchCenterQuickView
  readonly filters: WorkspaceSearchFiltersV1
  readonly controls: SearchCenterControls
  readonly selectedKey?: string
  readonly previewLimit: number
}

/** Ephemeral, controller-scoped UI state. Never persist free-form queries or snippets. */
export function createSearchHandoffChannel() {
  let snapshot: SearchCenterHandoff | undefined
  let settle: ((accepted: boolean) => void) | undefined
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    send(value: SearchCenterHandoff) {
      settle?.(false)
      snapshot = { ...value, filters: { ...value.filters }, controls: { ...value.controls } }
      for (const listener of listeners) listener()
    },
    acknowledge(value: SearchCenterHandoff) {
      if (snapshot !== value) return false
      if (settle) { settle(true); return true }
      snapshot = undefined
      for (const listener of listeners) listener()
      return true
    },
    request(value: SearchCenterHandoff, signal: AbortSignal, timeoutMs = 3000): Promise<boolean> {
      if (signal.aborted) return Promise.resolve(false)
      settle?.(false)
      const packet = { ...value, filters: { ...value.filters }, controls: { ...value.controls } }
      return new Promise(resolve => {
        let finished = false
        const finish = (accepted: boolean) => {
          if (finished) return
          finished = true
          clearTimeout(timer)
          signal.removeEventListener('abort', abort)
          settle = undefined
          if (snapshot === packet) snapshot = undefined
          resolve(accepted)
          for (const listener of listeners) listener()
        }
        const abort = () => finish(false)
        const timer = setTimeout(abort, timeoutMs)
        settle = finish
        signal.addEventListener('abort', abort, { once: true })
        snapshot = packet
        for (const listener of listeners) listener()
      })
    },
  }
}

const channels = new WeakMap<PaneWorkbenchController, ReturnType<typeof createSearchHandoffChannel>>()
export function searchHandoffChannel(controller: PaneWorkbenchController) {
  let channel = channels.get(controller)
  if (channel === undefined) { channel = createSearchHandoffChannel(); channels.set(controller, channel) }
  return channel
}

export function continueInSearchPane(controller: PaneWorkbenchController, registry: PaneViewRegistry, state: SearchCenterHandoff): boolean {
  if (!activateSearchPane(controller, registry)) return false
  searchHandoffChannel(controller).send(state)
  return true
}

export async function requestSearchPaneHandoff(controller: PaneWorkbenchController, registry: PaneViewRegistry, state: SearchCenterHandoff, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted || !activateSearchPane(controller, registry)) return false
  return searchHandoffChannel(controller).request(state, signal)
}

function activateSearchPane(controller: PaneWorkbenchController, registry: PaneViewRegistry): boolean {
  if (registry.get(DSH_WORKSPACE_SEARCH_VIEW_KIND) === undefined) return false
  try {
    openWorkspaceSearchPane(controller)
    const snapshot = controller.getSnapshot()
    const opened = Object.values(snapshot.views).find(view =>
      view.kind === DSH_WORKSPACE_SEARCH_VIEW_KIND && view.resourceKey === DSH_WORKSPACE_SEARCH_RESOURCE_KEY)
    if (!opened || snapshot.activeGroupId !== opened.groupId || snapshot.groups[opened.groupId]?.activeTabId !== opened.id) return false
    return true
  } catch { return false }
}
