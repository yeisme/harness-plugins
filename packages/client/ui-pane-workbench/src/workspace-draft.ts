import {
  PANE_WORKSPACE_LIMITS,
  type PaneGroupV1,
  type PaneRegionId,
  type PaneRegionStateV1,
  type PaneSplitNodeV1,
  type PaneWorkspaceV1,
} from './workspace.js'

export type PaneWorkspaceMotionPreferenceV1 = 'system' | 'full' | 'reduced'

export const PANE_WORKSPACE_DRAFT_SCHEMA = 'pane.workspace-draft.v1alpha1' as const

export type PaneWorkspaceDraftScopeV1 = 'session' | 'workspace' | 'profile'
export type PaneWorkspaceTabOverflowPolicyV1 = 'priority' | 'scroll'
export type PaneWorkspaceDraftIssueSeverity = 'error' | 'warning'

export interface PaneWorkspaceProviderPlacementV1 {
  readonly kind: string
  readonly region: PaneRegionId
  readonly role: PaneGroupV1['role']
  readonly singleton?: boolean
}

export interface PaneWorkspaceTabPolicyV1 {
  readonly previewOnSingleClick: boolean
  readonly overflow: PaneWorkspaceTabOverflowPolicyV1
}

export interface PaneWorkspaceDraftIssueV1 {
  readonly severity: PaneWorkspaceDraftIssueSeverity
  readonly code: string
  readonly message: string
}

export interface PaneWorkspaceDraftValidationV1 {
  readonly ok: boolean
  readonly errors: readonly PaneWorkspaceDraftIssueV1[]
  readonly warnings: readonly PaneWorkspaceDraftIssueV1[]
  readonly digest: string
}

export interface PaneWorkspaceDraftV1 {
  readonly schema: typeof PANE_WORKSPACE_DRAFT_SCHEMA
  readonly baseGeneration: number
  readonly scope: PaneWorkspaceDraftScopeV1
  readonly regions: Readonly<Record<PaneRegionId, Pick<PaneRegionStateV1, 'id' | 'visible' | 'size' | 'root'>>>
  readonly groups: Readonly<Record<string, Pick<PaneGroupV1, 'id' | 'region' | 'role' | 'locked'>>>
  readonly providerPlacements: readonly PaneWorkspaceProviderPlacementV1[]
  readonly railOrder: readonly string[]
  readonly tabPolicy: PaneWorkspaceTabPolicyV1
  readonly motionPreference: PaneWorkspaceMotionPreferenceV1
  readonly validation: PaneWorkspaceDraftValidationV1
}

const UNSAFE_DRAFT = /(?:^|[:/\\])(?:etc|home|usr|var|tmp)|file:\/\/|authorization|cookie|token|secret|password|api[_-]?key/i
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function digestOf(value: unknown): string {
  const text = JSON.stringify(value)
  let hash = 2_166_136_261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0).toString(36)
}

function collectGroupIds(node: PaneSplitNodeV1, output: string[] = []): string[] {
  if (node.type === 'group') output.push(node.groupId)
  else {
    collectGroupIds(node.first, output)
    collectGroupIds(node.second, output)
  }
  return output
}

function splitDepth(node: PaneSplitNodeV1): number {
  return node.type === 'group' ? 0 : 1 + Math.max(splitDepth(node.first), splitDepth(node.second))
}

export function validatePaneWorkspaceDraft(input: unknown): PaneWorkspaceDraftValidationV1 {
  const errors: PaneWorkspaceDraftIssueV1[] = []
  const warnings: PaneWorkspaceDraftIssueV1[] = []
  if (!isRecord(input) || input.schema !== PANE_WORKSPACE_DRAFT_SCHEMA) {
    errors.push({ severity: 'error', code: 'schema', message: 'Draft schema is not pane.workspace-draft.v1alpha1.' })
    return { ok: false, errors, warnings, digest: digestOf({ errors, warnings }) }
  }
  if (typeof input.baseGeneration !== 'number' || !Number.isSafeInteger(input.baseGeneration) || input.baseGeneration < 1) {
    errors.push({ severity: 'error', code: 'base_generation', message: 'Draft base generation is missing.' })
  }
  if (input.scope !== 'session' && input.scope !== 'workspace' && input.scope !== 'profile') {
    errors.push({ severity: 'error', code: 'scope', message: 'Draft scope must be session, workspace, or profile.' })
  }
  const serialized = JSON.stringify(input)
  if (UNSAFE_DRAFT.test(serialized) || serialized.includes('-----BEGIN')) {
    errors.push({ severity: 'error', code: 'unsafe_payload', message: 'Draft must not contain live resources or secrets.' })
  }
  if (isRecord(input.regions)) {
    for (const region of ['right', 'bottom'] as const) {
      const node = (input.regions[region] as { root?: PaneSplitNodeV1 } | undefined)?.root
      if (node === undefined) continue
      if (splitDepth(node) > PANE_WORKSPACE_LIMITS.maxSplitDepth) {
        errors.push({ severity: 'error', code: 'split_depth', message: `${region} exceeds max split depth.` })
      }
      if (collectGroupIds(node).length > PANE_WORKSPACE_LIMITS.maxVisibleGroups) {
        errors.push({ severity: 'error', code: 'group_limit', message: `${region} exceeds visible group limit.` })
      }
    }
  }
  if (Array.isArray(input.providerPlacements)) {
    for (const placement of input.providerPlacements) {
      if (!isRecord(placement) || typeof placement.kind !== 'string' || !ID_PATTERN.test(placement.kind)) {
        errors.push({ severity: 'error', code: 'placement', message: 'Provider placement kind is unsafe.' })
      }
    }
  }
  if (Array.isArray(input.railOrder) && input.railOrder.some(id => typeof id !== 'string' || !ID_PATTERN.test(id))) {
    errors.push({ severity: 'error', code: 'rail', message: 'Rail order contains an unsafe identifier.' })
  }
  return { ok: errors.length === 0, errors, warnings, digest: digestOf({ errors, warnings, baseGeneration: input.baseGeneration }) }
}

export function createPaneWorkspaceDraft(
  workspace: PaneWorkspaceV1,
  options: {
    readonly scope?: PaneWorkspaceDraftScopeV1
    readonly providerPlacements?: readonly PaneWorkspaceProviderPlacementV1[]
    readonly railOrder?: readonly string[]
    readonly tabPolicy?: Partial<PaneWorkspaceTabPolicyV1>
    readonly motionPreference?: PaneWorkspaceMotionPreferenceV1
  } = {},
): PaneWorkspaceDraftV1 {
  const draft: Omit<PaneWorkspaceDraftV1, 'validation'> = {
    schema: PANE_WORKSPACE_DRAFT_SCHEMA,
    baseGeneration: workspace.generation,
    scope: options.scope ?? 'workspace',
    regions: {
      right: {
        id: 'right',
        visible: workspace.regions.right.visible,
        size: workspace.regions.right.size,
        root: workspace.regions.right.root,
      },
      bottom: {
        id: 'bottom',
        visible: workspace.regions.bottom.visible,
        size: workspace.regions.bottom.size,
        root: workspace.regions.bottom.root,
      },
    },
    groups: Object.fromEntries(Object.values(workspace.groups).map(group => [group.id, {
      id: group.id,
      region: group.region,
      role: group.role,
      locked: group.locked,
    }])),
    providerPlacements: options.providerPlacements ?? [],
    railOrder: options.railOrder ?? ['explorer', 'source-control', 'terminal', 'agents', 'customize'],
    tabPolicy: {
      previewOnSingleClick: options.tabPolicy?.previewOnSingleClick ?? true,
      overflow: options.tabPolicy?.overflow ?? 'priority',
    },
    motionPreference: options.motionPreference ?? 'system',
  }
  return { ...draft, validation: validatePaneWorkspaceDraft(draft) }
}

export function serializePaneWorkspaceDraft(draft: PaneWorkspaceDraftV1): PaneWorkspaceDraftV1 {
  const report = validatePaneWorkspaceDraft(draft)
  return {
    schema: PANE_WORKSPACE_DRAFT_SCHEMA,
    baseGeneration: draft.baseGeneration,
    scope: draft.scope,
    regions: draft.regions,
    groups: draft.groups,
    providerPlacements: draft.providerPlacements,
    railOrder: draft.railOrder,
    tabPolicy: draft.tabPolicy,
    motionPreference: draft.motionPreference,
    validation: report,
  }
}

export function parsePaneWorkspaceDraft(input: unknown): PaneWorkspaceDraftV1 | undefined {
  const report = validatePaneWorkspaceDraft(input)
  if (!report.ok || !isRecord(input)) return undefined
  return serializePaneWorkspaceDraft(input as unknown as PaneWorkspaceDraftV1)
}
