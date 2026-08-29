/**
 * Frozen V4 admission ledger. Explorer/Git/locale stay split-owner;
 * Pane Workbench Core remains the single layout reducer owner.
 */
export const PANE_WORKSPACE_INTERACTION_V4_OWNER_FIT = 'split-owner' as const
export const PANE_WORKSPACE_REDUCER_OWNER = 'pane-workbench-core' as const

export type PaneWorkspaceInteractionV4RequirementStatus = 'required'
export type PaneWorkspaceInteractionV4RequirementId =
  | 'explorer-tree-interaction'
  | 'git-interaction'
  | 'pane-management-i18n'
  | 'drag-motion'
  | 'tab-system'
  | 'workspace-designer'

export interface PaneWorkspaceInteractionV4Requirement {
  readonly id: PaneWorkspaceInteractionV4RequirementId
  readonly status: PaneWorkspaceInteractionV4RequirementStatus
  readonly deliverySlice: 'V4-Foundation' | 'V4-A' | 'V4-A/V4-B' | 'V4-B'
}

export const PANE_WORKSPACE_INTERACTION_V4_LEDGER = Object.freeze({
  ownerFit: PANE_WORKSPACE_INTERACTION_V4_OWNER_FIT,
  admission: PANE_WORKSPACE_INTERACTION_V4_OWNER_FIT,
  reducerOwner: PANE_WORKSPACE_REDUCER_OWNER,
  reducerOwnerCount: 1,
  capabilities: Object.freeze([
    Object.freeze({
      id: 'explorer-tree-interaction',
      status: 'required',
      deliverySlice: 'V4-A',
    }),
    Object.freeze({
      id: 'git-interaction',
      status: 'required',
      deliverySlice: 'V4-A/V4-B',
    }),
    Object.freeze({
      id: 'pane-management-i18n',
      status: 'required',
      deliverySlice: 'V4-Foundation',
    }),
    Object.freeze({
      id: 'drag-motion',
      status: 'required',
      deliverySlice: 'V4-Foundation',
    }),
    Object.freeze({
      id: 'tab-system',
      status: 'required',
      deliverySlice: 'V4-Foundation',
    }),
    Object.freeze({
      id: 'workspace-designer',
      status: 'required',
      deliverySlice: 'V4-B',
    }),
  ] satisfies readonly PaneWorkspaceInteractionV4Requirement[]),
})

/** Additive File/Git V2 capability names. V1 probe strings stay unchanged. */
export const FILE_TREE_PROJECTION_CAPABILITY = 'FileTreeProjectionCapabilityV1' as const
export const GIT_STATUS_PROJECTION_CAPABILITY_V2 = 'GitStatusProjectionCapabilityV2' as const
export const GIT_DIFF_WINDOW_CAPABILITY = 'GitDiffWindowCapabilityV1' as const
export const GIT_BRANCH_ACTIONS_CAPABILITY = 'GitBranchActionsCapabilityV1' as const
export const GIT_REMOTE_ACTIONS_CAPABILITY = 'GitRemoteActionsCapabilityV1' as const
export const GIT_WORKTREE_ACTIONS_CAPABILITY_V2 = 'GitWorktreeActionsCapabilityV2' as const

export const PANE_FILE_GIT_V2_CAPABILITIES = Object.freeze([
  FILE_TREE_PROJECTION_CAPABILITY,
  GIT_STATUS_PROJECTION_CAPABILITY_V2,
  GIT_DIFF_WINDOW_CAPABILITY,
  GIT_BRANCH_ACTIONS_CAPABILITY,
  GIT_REMOTE_ACTIONS_CAPABILITY,
  GIT_WORKTREE_ACTIONS_CAPABILITY_V2,
] as const)

/**
 * Experience Tier seam probe points (workspace-capability-matrix). These are
 * structural probe coordinates only: the plugin reads ctx services and never
 * fakes, polls, or persists the result. Unpublished seams stay `missing`.
 */
export const COMMAND_SURFACE_CONTEXT_KEY = 'commands' as const
export const TERMINAL_HOST_CONTEXT_KEY = 'dsh.terminalHost' as const
export const PREVIEW_RESOURCE_CONTEXT_KEY = 'dsh.previewResource' as const
export const ARTIFACT_INTENT_CONTEXT_KEY = 'dsh.artifactIntents' as const
export const PREVIEW_RESOURCE_CAPABILITY = 'PreviewResourceV1' as const
export const ARTIFACT_INTENT_CAPABILITY = 'ArtifactIntentV1' as const
