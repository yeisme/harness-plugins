import { createPaneWorkspace } from './workspace.js'
import {
  createPaneWorkspaceDraft,
  serializePaneWorkspaceDraft,
  type PaneWorkspaceDraftScopeV1,
  type PaneWorkspaceDraftV1,
} from './workspace-draft.js'

export const PANE_WORKSPACE_PRESET_SERVICE = 'PaneWorkspacePresetServiceV1' as const

export type PaneWorkspacePresetIdV1 = 'focus' | 'code' | 'review' | 'media' | string

export interface PaneWorkspacePresetSummaryV1 {
  readonly id: string
  readonly name: string
  readonly scope: PaneWorkspaceDraftScopeV1
  readonly builtin: boolean
  readonly readonly: boolean
}

export interface PaneWorkspacePresetReceiptV1 {
  readonly status: 'ok' | 'rejected' | 'permission_denied'
  readonly action: 'create' | 'update' | 'delete' | 'reset'
  readonly id?: string
  readonly reason?: string
}

export interface PaneWorkspaceSettingsOwnerV1 {
  readonly allowedScopes: readonly PaneWorkspaceDraftScopeV1[]
  create(name: string, scope: PaneWorkspaceDraftScopeV1, draft: PaneWorkspaceDraftV1): Promise<PaneWorkspacePresetReceiptV1>
  update(id: string, draft: PaneWorkspaceDraftV1): Promise<PaneWorkspacePresetReceiptV1>
  delete(id: string): Promise<PaneWorkspacePresetReceiptV1>
  reset(scope: PaneWorkspaceDraftScopeV1): Promise<PaneWorkspacePresetReceiptV1>
}

export interface PaneWorkspacePresetServiceV1 {
  readonly version: typeof PANE_WORKSPACE_PRESET_SERVICE
  list(): readonly PaneWorkspacePresetSummaryV1[]
  get(id: string): PaneWorkspaceDraftV1 | undefined
  create(name: string, scope: PaneWorkspaceDraftScopeV1, draft: PaneWorkspaceDraftV1): Promise<PaneWorkspacePresetReceiptV1>
  update(id: string, draft: PaneWorkspaceDraftV1): Promise<PaneWorkspacePresetReceiptV1>
  delete(id: string): Promise<PaneWorkspacePresetReceiptV1>
  reset(scope: PaneWorkspaceDraftScopeV1): Promise<PaneWorkspacePresetReceiptV1>
}

const BUILTIN_ORDER = ['focus', 'code', 'review', 'media'] as const

function builtinDraft(id: (typeof BUILTIN_ORDER)[number]): PaneWorkspaceDraftV1 {
  const workspace = createPaneWorkspace()
  const rail = id === 'focus'
    ? ['explorer', 'customize']
    : id === 'code'
      ? ['explorer', 'source-control', 'terminal', 'customize']
      : id === 'review'
        ? ['source-control', 'explorer', 'customize']
        : ['explorer', 'media', 'customize']
  return createPaneWorkspaceDraft(workspace, {
    railOrder: rail,
    motionPreference: id === 'media' ? 'full' : 'system',
    tabPolicy: { previewOnSingleClick: id !== 'review', overflow: 'priority' },
  })
}

export function createBuiltinPaneWorkspacePresets(): Readonly<Record<(typeof BUILTIN_ORDER)[number], PaneWorkspaceDraftV1>> {
  return {
    focus: builtinDraft('focus'),
    code: builtinDraft('code'),
    review: builtinDraft('review'),
    media: builtinDraft('media'),
  }
}

export function createPaneWorkspacePresetService(owner?: PaneWorkspaceSettingsOwnerV1): PaneWorkspacePresetServiceV1 {
  const builtins = createBuiltinPaneWorkspacePresets()
  return {
    version: PANE_WORKSPACE_PRESET_SERVICE,
    list() {
      return BUILTIN_ORDER.map(id => ({
        id,
        name: id[0]!.toUpperCase() + id.slice(1),
        scope: 'workspace' as const,
        builtin: true,
        readonly: true,
      }))
    },
    get(id) {
      return id in builtins ? serializePaneWorkspaceDraft(builtins[id as (typeof BUILTIN_ORDER)[number]]) : undefined
    },
    async create(name, scope, draft) {
      if (owner === undefined) {
        return { status: 'rejected', action: 'create', reason: 'DSH settings/application service is unavailable' }
      }
      if (!owner.allowedScopes.includes(scope)) {
        return { status: 'permission_denied', action: 'create', reason: `${scope} scope is not permitted` }
      }
      return owner.create(name, scope, serializePaneWorkspaceDraft(draft))
    },
    async update(id, draft) {
      if (id in builtins) return { status: 'rejected', action: 'update', reason: 'built-in presets are read-only' }
      if (owner === undefined) return { status: 'rejected', action: 'update', reason: 'DSH settings/application service is unavailable' }
      return owner.update(id, serializePaneWorkspaceDraft(draft))
    },
    async delete(id) {
      if (id in builtins) return { status: 'rejected', action: 'delete', reason: 'built-in presets are read-only' }
      if (owner === undefined) return { status: 'rejected', action: 'delete', reason: 'DSH settings/application service is unavailable' }
      return owner.delete(id)
    },
    async reset(scope) {
      if (owner === undefined) return { status: 'rejected', action: 'reset', reason: 'DSH settings/application service is unavailable' }
      if (!owner.allowedScopes.includes(scope)) {
        return { status: 'permission_denied', action: 'reset', reason: `${scope} scope is not permitted` }
      }
      return owner.reset(scope)
    },
  }
}

export function presetScopePermission(owner: PaneWorkspaceSettingsOwnerV1 | undefined, scope: PaneWorkspaceDraftScopeV1): {
  readonly allowed: boolean
  readonly reason?: string
} {
  if (owner === undefined) return { allowed: false, reason: 'settings owner is unavailable' }
  if (!owner.allowedScopes.includes(scope)) return { allowed: false, reason: `${scope} scope is not permitted` }
  return { allowed: true }
}
