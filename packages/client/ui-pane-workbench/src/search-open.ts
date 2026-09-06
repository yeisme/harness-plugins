import type { PaneCommandRegistry } from './composition.js'
import type { PaneWorkbenchController } from './controller.js'
import type { PaneConversationSearchHostV1, PaneWorkspaceContextProviderV1 } from './management.js'
import type { WorkspaceSearchCandidateV1, WorkspaceSearchOpenTargetV1 } from './search-identity.js'
import { DSH_WORKSPACE_SEARCH_RESOURCE_KEY, DSH_WORKSPACE_SEARCH_VIEW_KIND } from './core-pane.js'
import type { PaneViewRegistry } from './view-registry.js'

/** `/search` launcher id: opens the pinned search pane through the pane command projection. */
export const WORKSPACE_SEARCH_COMMAND_ID = 'workspace.search' as const

export type WorkspaceSearchOpenPlacementV1 = 'default' | 'right' | 'bottom' | 'float'

export interface WorkspaceSearchOpenResultV1 {
  readonly ok: boolean
  readonly reason?: string
  readonly placed?: WorkspaceSearchOpenPlacementV1
}

export function openWorkspaceSearchPane(controller: PaneWorkbenchController): void {
  controller.openView({
    kind: DSH_WORKSPACE_SEARCH_VIEW_KIND,
    resourceKey: DSH_WORKSPACE_SEARCH_RESOURCE_KEY,
    role: 'utility',
    preferredRegion: 'right',
    retention: 'recreate',
    singleton: true,
    preview: false,
    pinned: true,
    title: 'Search',
  })
}

export async function activateWorkspaceSearchCandidate(input: {
  readonly candidate: WorkspaceSearchCandidateV1
  readonly controller: PaneWorkbenchController
  readonly registry: PaneViewRegistry
  readonly commands?: PaneCommandRegistry
  readonly conversationSearch?: PaneConversationSearchHostV1
  readonly workspaceContext?: PaneWorkspaceContextProviderV1
  readonly placement?: WorkspaceSearchOpenPlacementV1
}): Promise<WorkspaceSearchOpenResultV1> {
  const placement = input.placement ?? 'default'
  const target = input.candidate.openTarget
  if (input.candidate.availability === 'unavailable') return { ok: false, reason: input.candidate.reason ?? 'unavailable' }
  if (target.type === 'command') {
    if (input.candidate.sideEffect && placement !== 'default') return { ok: false, reason: 'command_requires_explicit_run' }
    if (input.commands === undefined) return { ok: false, reason: 'command_owner_missing' }
    try {
      await input.commands.execute(target.commandId ?? input.candidate.commandId ?? '')
      return { ok: true, placed: 'default' }
    } catch {
      return { ok: false, reason: 'command_failed' }
    }
  }
  if (target.type === 'session') {
    const item = {
      sessionRef: target.sessionRef ?? '',
      messageRef: target.messageRef ?? target.sessionRef ?? '',
      title: input.candidate.title,
      snippet: input.candidate.snippet ?? input.candidate.description ?? '',
    }
    try {
      await input.conversationSearch?.open(item)
      return { ok: true, placed: placement }
    } catch {
      return { ok: false, reason: 'session_open_failed' }
    }
  }
  return openPaneTarget(input.controller, input.registry, target, input.candidate.title, placement)
}

function openPaneTarget(
  controller: PaneWorkbenchController,
  registry: PaneViewRegistry,
  target: WorkspaceSearchOpenTargetV1,
  title: string,
  placement: WorkspaceSearchOpenPlacementV1,
): WorkspaceSearchOpenResultV1 {
  const kind = target.viewKind
  if (kind === undefined) return { ok: false, reason: 'view_kind_missing' }
  const descriptor = registry.get(kind)?.descriptor
  if (descriptor === undefined) return { ok: false, reason: 'provider_missing' }
  const existing = target.viewId !== undefined
    ? controller.getSnapshot().views[target.viewId]
    : Object.values(controller.getSnapshot().views).find(view => view.kind === kind && view.resourceKey === (target.resourceKey ?? `view:${kind}`))
  if (existing !== undefined) {
    controller.dispatch({ type: 'activate_view', viewId: existing.id })
    return placeOpenView(controller, existing.id, placement)
  }
  controller.openView({
    kind: descriptor.kind,
    resourceKey: target.resourceKey ?? `view:${descriptor.kind}`,
    role: descriptor.role,
    preferredRegion: descriptor.preferredRegion,
    retention: descriptor.retention,
    singleton: descriptor.singleton,
    pinned: placement !== 'default',
    title,
  })
  const opened = Object.values(controller.getSnapshot().views).find(view => view.kind === descriptor.kind && view.resourceKey === (target.resourceKey ?? `view:${descriptor.kind}`))
  if (opened === undefined) return { ok: false, reason: 'open_failed' }
  return placeOpenView(controller, opened.id, placement)
}

function placeOpenView(controller: PaneWorkbenchController, viewId: string, placement: WorkspaceSearchOpenPlacementV1): WorkspaceSearchOpenResultV1 {
  if (placement === 'default') return { ok: true, placed: 'default' }
  const tier = controller.experienceTier?.getSnapshot().tier ?? 1
  if (tier === 0 && placement !== 'float') return { ok: false, reason: 'geometry_unavailable' }
  const view = controller.getSnapshot().views[viewId]
  if (view === undefined) return { ok: false, reason: 'open_failed' }
  if (placement === 'float') {
    controller.dispatch({ type: 'maximize_group', groupId: view.groupId })
    return { ok: true, placed: 'float' }
  }
  const edge = placement === 'right' ? 'right' : 'bottom'
  const result = controller.dispatch({ type: 'split_with_view', viewId, targetGroupId: view.groupId, edge })
  if (!result.accepted) return { ok: false, reason: result.reason ?? 'placement_failed' }
  return { ok: true, placed: placement }
}

export function workspaceSearchDragPayload(candidate: WorkspaceSearchCandidateV1): string {
  return JSON.stringify({
    schema: 'workspace.search.drag.v1',
    stableKey: candidate.stableKey,
    kind: candidate.kind,
    title: candidate.title,
    openTarget: candidate.openTarget,
  })
}

export const WORKSPACE_SEARCH_DRAG_MIME = 'application/x-yeisme-workspace-search'

export function parseWorkspaceSearchDragPayload(raw: string): { readonly openTarget: WorkspaceSearchCandidateV1['openTarget']; readonly title: string; readonly stableKey: string } | undefined {
  try {
    const value = JSON.parse(raw) as { schema?: string; openTarget?: WorkspaceSearchCandidateV1['openTarget']; title?: string; stableKey?: string }
    if (value.schema !== 'workspace.search.drag.v1' || value.openTarget === undefined || typeof value.title !== 'string' || typeof value.stableKey !== 'string') return undefined
    return { openTarget: value.openTarget, title: value.title, stableKey: value.stableKey }
  } catch {
    return undefined
  }
}
