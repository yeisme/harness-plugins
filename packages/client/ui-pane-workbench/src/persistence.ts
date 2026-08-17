import {
  PANE_WORKSPACE_SCHEMA,
  normalizePaneWorkspace,
  type PaneGroupV1,
  type PaneRegionId,
  type PaneSplitNodeV1,
  type PaneViewInstanceV1,
  type PaneWorkspaceV1,
} from './workspace.js'

export const PANE_WORKSPACE_PERSISTED_SCHEMA = 'pane.workspace.persisted.v1alpha1' as const

export interface PanePersistedViewV1 {
  readonly id: string
  readonly kind: string
  readonly resourceKey: string
  readonly role: PaneViewInstanceV1['role']
  readonly region: PaneRegionId
  readonly groupId: string
  readonly title: string
  readonly retention: PaneViewInstanceV1['retention']
  readonly singleton: boolean
  readonly preview: boolean
  readonly pinned: boolean
  readonly dirty: boolean
  readonly duplicate: boolean
  readonly closePolicy: PaneViewInstanceV1['closePolicy']
  readonly status: PaneViewInstanceV1['status']
}

export interface PaneWorkspacePersistedV1 {
  readonly schema: typeof PANE_WORKSPACE_PERSISTED_SCHEMA
  readonly sourceSchema: typeof PANE_WORKSPACE_SCHEMA
  readonly regions: Readonly<Record<PaneRegionId, { readonly id: PaneRegionId; readonly visible: boolean; readonly size: number; readonly root: PaneSplitNodeV1 }>>
  readonly groups: Readonly<Record<string, PaneGroupV1>>
  readonly views: Readonly<Record<string, PanePersistedViewV1>>
  readonly activeRegion: PaneRegionId
  readonly activeGroupId?: string
  readonly maximizedGroupId?: string
}

/** Serialize presentation state only; history, metadata, and domain payloads are intentionally omitted. */
export function serializePaneWorkspace(state: PaneWorkspaceV1): PaneWorkspacePersistedV1 {
  return {
    schema: PANE_WORKSPACE_PERSISTED_SCHEMA,
    sourceSchema: PANE_WORKSPACE_SCHEMA,
    regions: {
      right: { ...state.regions.right },
      bottom: { ...state.regions.bottom },
    },
    groups: Object.fromEntries(Object.entries(state.groups).map(([id, group]) => [id, { ...group, tabs: [...group.tabs] }])),
    views: Object.fromEntries(Object.entries(state.views).map(([id, view]) => [id, {
      id: view.id,
      kind: view.kind,
      resourceKey: view.resourceKey,
      role: view.role,
      region: view.region,
      groupId: view.groupId,
      title: view.title,
      retention: view.retention,
      singleton: view.singleton,
      preview: view.preview,
      pinned: view.pinned,
      dirty: view.dirty,
      duplicate: view.duplicate,
      closePolicy: view.closePolicy,
      status: view.status,
    }])),
    activeRegion: state.activeRegion,
    activeGroupId: state.activeGroupId,
    maximizedGroupId: state.maximizedGroupId,
  }
}

/** Restore through the normalizer so stale/invalid local layout never blocks the workbench. */
export function restorePaneWorkspace(input: unknown, generation = 1): PaneWorkspaceV1 {
  if (input === null || typeof input !== 'object' || (input as { schema?: unknown }).schema !== PANE_WORKSPACE_PERSISTED_SCHEMA) {
    return normalizePaneWorkspace(undefined, generation)
  }
  return normalizePaneWorkspace(input, generation)
}

