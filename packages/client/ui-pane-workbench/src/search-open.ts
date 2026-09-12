import type { PaneCommandRegistry } from './composition.js'
import type { PaneWorkbenchController } from './controller.js'
import type { PaneConversationSearchHostV1, PaneWorkspaceContextProviderV1 } from './management.js'
import type { WorkspaceSearchCandidateV1, WorkspaceSearchOpenTargetV1 } from './search-identity.js'
import { DSH_WORKSPACE_SEARCH_RESOURCE_KEY, DSH_WORKSPACE_SEARCH_VIEW_KIND } from './core-pane.js'
import { hasWorkspaceSearchOrigin, openWorkspaceSearchOrigin } from './search-target-origin.js'
import { PaneActionReceiptSchema } from '@yeisme/dsh-pane-protocol'
import type { PaneViewRegistry } from './view-registry.js'
import type { PaneSplitNodeV1 } from './workspace.js'

/** `/search` launcher id: opens the pinned search pane through the pane command projection. */
export const WORKSPACE_SEARCH_COMMAND_ID = 'workspace.search' as const

export type WorkspaceSearchOpenPlacementV1 = 'default' | 'right' | 'bottom' | 'float'

export interface WorkspaceSearchOpenResultV1 {
  readonly ok: boolean
  readonly reason?: string
  readonly placed?: WorkspaceSearchOpenPlacementV1
}

/** Capability admission only; the actual owner must still confirm the operation. */
export function workspaceSearchPlacementSupport(candidate: WorkspaceSearchCandidateV1, controller: PaneWorkbenchController, placement: WorkspaceSearchOpenPlacementV1): WorkspaceSearchOpenResultV1 {
  if (candidate.availability !== 'available') return { ok: false, reason: candidate.reason ?? 'unavailable' }
  if (placement === 'default') return { ok: true }
  if (hasWorkspaceSearchOrigin(candidate)) return { ok: false, reason: 'workspace_placement_unsupported' }
  if (candidate.kind !== 'pane') return { ok: false, reason: `${candidate.kind}_placement_unsupported` }
  if (placement === 'float') return { ok: false, reason: 'float_placement_unsupported' }
  if (controller.experienceTier?.getSnapshot().tier === 0) return { ok: false, reason: 'geometry_unavailable' }
  return { ok: true }
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
  const support = workspaceSearchPlacementSupport(input.candidate, input.controller, placement)
  if (!support.ok) return support
  const ownerOpened = await openWorkspaceSearchOrigin(input.candidate, placement)
  if (ownerOpened !== undefined) return ownerOpened
  if (target.type === 'command') {
    if (input.candidate.sideEffect && placement !== 'default') return { ok: false, reason: 'command_requires_explicit_run' }
    if (input.commands === undefined) return { ok: false, reason: 'command_owner_missing' }
    try {
      const output = await input.commands.execute(target.commandId ?? input.candidate.commandId ?? '')
      const receipt = PaneActionReceiptSchema.safeParse(output)
      if (output !== undefined && !receipt.success) return { ok: false, reason: 'command_unknown' }
      if (receipt.success && receipt.data.status !== 'completed') return { ok: false, reason: `command_${receipt.data.status}` }
      return { ok: true, placed: 'default' }
    } catch {
      return { ok: false, reason: 'command_failed' }
    }
  }
  if (target.type === 'session') {
    if (typeof input.conversationSearch?.open !== 'function') return { ok: false, reason: 'session_open_unavailable' }
    if (placement !== 'default') return { ok: false, reason: 'session_placement_unsupported' }
    const item = {
      sessionRef: target.sessionRef ?? '',
      messageRef: target.messageRef ?? target.sessionRef ?? '',
      title: input.candidate.title,
      snippet: input.candidate.snippet ?? input.candidate.description ?? '',
    }
    try {
      await input.conversationSearch.open(item)
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
  const before = controller.getSnapshot()
  const anchorGroupId = before.activeGroupId
  const resourceKey = target.resourceKey ?? `view:${kind}`
  const existing = target.viewId !== undefined
    ? before.views[target.viewId]
    : Object.values(before.views).find(view => view.kind === kind && view.resourceKey === resourceKey)
  if (target.viewId !== undefined && (existing === undefined || existing.kind !== kind || existing.resourceKey !== resourceKey)) return { ok: false, reason: 'target_changed' }
  if (placement !== 'default' && (anchorGroupId === undefined || before.groups[anchorGroupId] === undefined
    || (existing?.groupId === anchorGroupId && before.groups[anchorGroupId]!.tabs.length <= 1))) return { ok: false, reason: 'split_anchor_unavailable' }
  if (existing !== undefined) {
    if (placement === 'default') {
      const activated = controller.dispatch({ type: 'activate_view', viewId: existing.id })
      if (!activated.accepted) return { ok: false, reason: 'activation_failed' }
    }
    return placeOpenView(controller, existing.id, placement, anchorGroupId)
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
  return placeOpenView(controller, opened.id, placement, anchorGroupId)
}

function placeOpenView(controller: PaneWorkbenchController, viewId: string, placement: WorkspaceSearchOpenPlacementV1, anchorGroupId?: string): WorkspaceSearchOpenResultV1 {
  if (placement === 'default') {
    const state = controller.getSnapshot()
    const view = state.views[viewId]
    return view !== undefined && state.groups[view.groupId]?.activeTabId === viewId && state.activeGroupId === view.groupId
      ? { ok: true, placed: 'default' } : { ok: false, reason: 'activation_unconfirmed' }
  }
  const tier = controller.experienceTier?.getSnapshot().tier ?? 1
  if (tier === 0 && placement !== 'float') return { ok: false, reason: 'geometry_unavailable' }
  const view = controller.getSnapshot().views[viewId]
  if (view === undefined) return { ok: false, reason: 'open_failed' }
  if (placement === 'float') {
    return { ok: false, reason: 'float_placement_unsupported' }
  }
  if (anchorGroupId === undefined) return { ok: false, reason: 'split_anchor_unavailable' }
  const edge = placement === 'right' ? 'right' : 'bottom'
  const result = controller.dispatch({ type: 'split_with_view', viewId, targetGroupId: anchorGroupId, edge })
  if (!result.accepted) return { ok: false, reason: result.reason ?? 'placement_failed' }
  const after = controller.getSnapshot()
  const placed = after.views[viewId]
  if (placed === undefined || placed.groupId === anchorGroupId || after.groups[anchorGroupId] === undefined
    || after.groups[placed.groupId]?.activeTabId !== viewId) return { ok: false, reason: 'placement_unconfirmed' }
  if (!confirmsSplit(after.regions[placed.region].root, anchorGroupId, placed.groupId, edge)) return { ok: false, reason: 'placement_unconfirmed' }
  return { ok: true, placed: placement }
}

function confirmsSplit(node: PaneSplitNodeV1, anchor: string, placed: string, edge: 'right' | 'bottom'): boolean {
  if (node.type === 'group') return false
  const contains = (branch: PaneSplitNodeV1, id: string): boolean => branch.type === 'group'
    ? branch.groupId === id : contains(branch.first, id) || contains(branch.second, id)
  return (node.orientation === (edge === 'right' ? 'horizontal' : 'vertical') && contains(node.first, anchor) && contains(node.second, placed))
    || confirmsSplit(node.first, anchor, placed, edge) || confirmsSplit(node.second, anchor, placed, edge)
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
