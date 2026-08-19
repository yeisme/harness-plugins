import {
  PANE_WORKSPACE_SCHEMA,
  createPaneWorkspace,
  normalizePaneWorkspace,
  type PaneGroupV1,
  type PaneRegionId,
  type PaneSplitNodeV1,
  type PaneViewInstanceV1,
  type PaneWorkspaceV1,
} from './workspace.js'

export const PANE_WORKSPACE_PERSISTED_SCHEMA = 'pane.workspace.persisted.v1alpha1' as const
export const PANE_WORKSPACE_STORAGE_NAMESPACE = 'yeisme.dsh.pane-workbench' as const

export interface PaneWorkspaceStorageV1 {
  getItem(key: string): string | null | undefined
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

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
  try {
    return normalizePaneWorkspace(input, generation)
  } catch {
    return createPaneWorkspace(generation)
  }
}

/**
 * Safe storage adapter for session layouts and named presentation presets.
 * Only serializePaneWorkspace output is written; storage failures recover to the default layout.
 */
export class PaneWorkspacePersistenceAdapter {
  private readonly namespace: string

  constructor(
    private readonly storage: PaneWorkspaceStorageV1,
    namespace = PANE_WORKSPACE_STORAGE_NAMESPACE,
  ) {
    this.namespace = safeStoragePart(namespace) ? namespace : PANE_WORKSPACE_STORAGE_NAMESPACE
  }

  load(generation = 1): PaneWorkspaceV1 {
    return this.loadSession(generation)
  }

  loadSession(generation = 1): PaneWorkspaceV1 {
    return restorePaneWorkspace(this.read(this.sessionKey()), generation)
  }

  save(state: PaneWorkspaceV1): boolean {
    return this.saveSession(state)
  }

  saveSession(state: PaneWorkspaceV1): boolean {
    return this.write(this.sessionKey(), state)
  }

  reset(generation = 1): PaneWorkspaceV1 {
    this.deleteLocalLayout()
    return createPaneWorkspace(generation)
  }

  deleteLocalLayout(): boolean {
    return this.remove(this.sessionKey())
  }

  savePreset(name: string, state: PaneWorkspaceV1): boolean {
    const key = this.presetKey(name)
    return key === undefined ? false : this.write(key, state)
  }

  loadPreset(name: string, generation = 1): PaneWorkspaceV1 {
    const key = this.presetKey(name)
    return restorePaneWorkspace(key === undefined ? undefined : this.read(key), generation)
  }

  deletePreset(name: string): boolean {
    const key = this.presetKey(name)
    return key === undefined ? false : this.remove(key)
  }

  private sessionKey(): string {
    return `${this.namespace}:session`
  }

  private presetKey(name: string): string | undefined {
    return safeStoragePart(name) ? `${this.namespace}:preset:${name}` : undefined
  }

  private read(key: string): unknown {
    try {
      const value = this.storage.getItem(key)
      return typeof value === 'string' ? JSON.parse(value) as unknown : undefined
    } catch {
      return undefined
    }
  }

  private write(key: string, state: PaneWorkspaceV1): boolean {
    try {
      const safeState = normalizePaneWorkspace(state, state.generation)
      this.storage.setItem(key, JSON.stringify(serializePaneWorkspace(safeState)))
      return true
    } catch {
      return false
    }
  }

  private remove(key: string): boolean {
    try {
      this.storage.removeItem(key)
      return true
    } catch {
      return false
    }
  }
}

function safeStoragePart(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 && /^[a-z0-9][a-z0-9._:-]*$/i.test(value)
}
