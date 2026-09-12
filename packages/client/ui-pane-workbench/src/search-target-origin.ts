import type { WorkspaceSearchCandidateV1 } from './search-identity.js'
import type { PaneWorkspaceContextProviderV1, PaneWorkspaceSearchItemV1 } from './management.js'
import type { WorkspaceSearchOpenPlacementV1, WorkspaceSearchOpenResultV1 } from './search-open.js'

const origins = new WeakMap<WorkspaceSearchCandidateV1, { owner: PaneWorkspaceContextProviderV1; item: PaneWorkspaceSearchItemV1 }>()

export function hasWorkspaceSearchOrigin(candidate: WorkspaceSearchCandidateV1): boolean {
  return origins.has(candidate)
}

/** Preserve the exact owner-authored target without expanding the V1 target union. */
export function bindWorkspaceSearchOrigin(candidate: WorkspaceSearchCandidateV1, owner: PaneWorkspaceContextProviderV1, item: PaneWorkspaceSearchItemV1): void {
  origins.set(candidate, { owner, item })
}

export async function openWorkspaceSearchOrigin(candidate: WorkspaceSearchCandidateV1, placement: WorkspaceSearchOpenPlacementV1): Promise<WorkspaceSearchOpenResultV1 | undefined> {
  const origin = origins.get(candidate)
  if (origin === undefined) return undefined
  if (placement !== 'default') return { ok: false, reason: 'workspace_placement_unsupported' }
  if (typeof origin.owner.open !== 'function') return { ok: false, reason: 'workspace_open_unavailable' }
  try {
    const allowed = new Set(origin.owner.listWorkspaces?.().map(target => target.workspaceRef) ?? [])
    const current = origin.owner.getSnapshot().workspaceRef
    if (current !== undefined) allowed.add(current)
    if (!allowed.has(origin.item.workspaceRef)) return { ok: false, reason: 'project_unavailable' }
    await origin.owner.open(origin.item)
    return { ok: true, placed: 'default' }
  } catch {
    return { ok: false, reason: 'workspace_open_failed' }
  }
}
